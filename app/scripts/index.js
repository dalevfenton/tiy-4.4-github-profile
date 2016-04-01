//to get authentication to work cd into the gatekeeper folder and run: node server.js
//then run the site as normal through npm run watch
//documentation and install instructions here: https://github.com/prose/gatekeeper
//------------------------------------------------------------------------------
//                        LIBRARIES
//------------------------------------------------------------------------------
var $;
window.jQuery = $ = require('jquery');
var _ = require('underscore');
var Handlebars = require('handlebars/runtime')['default'];
var bootstrap = require('bootstrap-sass/assets/javascripts/bootstrap.min.js');

//------------------------------------------------------------------------------
//
//------------------------------------------------------------------------------
//CACHED DATA USED DURING DEVELOPMENT SO WE DON'T HAVE TO CALL THE API
//EVERY TIME WE UPDATE CSS OR HTML FILES
// var cache = require('./keys.js');
//SETUP GLOBAL VARIABLES
var githubtoken, userReturn, reposReturned, newrepoReturned, gitignores, licenses;
var monthNames = ["January", "February", "March","April", "May", "June","July", "August", "September","October", "November", "December"];
var orgs, user_info, repoSort, repoLoaded, data, sortRepos, searchRepos;
var oAuthURL = 'https://github.com/login/oauth/authorize';
var loggedIn = false;
var gitLogin, userURL, orgsUrl;
//------------------------------------------------------------------------------
//                        TEMPLATE IMPORTS
//------------------------------------------------------------------------------
var loading = require('./loading.handlebars');
var header = require('./header.handlebars');
var sidebar = require('./sidebar.handlebars');
var repos = require('./repos.handlebars');
var newrepo = require('./newrepo.handlebars');
var reposuccess = require('./reposuccess.handlebars');

//HANDLEBARS TEMPLATE HELPER FUNCTIONS
Handlebars.registerHelper('scale-bar', function( object, scale ) {
  return new Handlebars.SafeString( object * scale );
});
Handlebars.registerHelper('percent-offset', function(object) {
  return new Handlebars.SafeString( object / 52 * 100 );
});

//------------------------------------------------------------------------------
//                        INITIALIZE THE PAGE
//------------------------------------------------------------------------------
initializePage();

//function that we invoke on pageload to control flow from here on out
function initializePage(){
  //detect if we have gotten a stage one code from github to auth with
  if(document.URL.indexOf('?code=') > -1){
    var code = document.URL.match(/\?code=(.*)/);

    var herokuServer = 'http://github-clone.herokuapp.com/api';
    $.ajax({
      url: herokuServer,
      data: {
        token: code[1]
      }
    }).then(function(data){
      var pairs = data.split('&');
      var result = {};
      pairs.forEach(function(pair) {
          pair = pair.split('=');
          result[pair[0]] = decodeURIComponent(pair[1] || '');
      });
      if(typeof(result.access_token) !== "undefined"){
        loggedIn = true;
        $.ajaxSetup({
          headers: {
            'Authorization': 'token ' + result.access_token,
            'Accept': 'application/vnd.github.drax-preview+json'
          }
        });
        //set loading indication
        $('.loading-login-inner').html('<h2>Loading Your Page This Can Take a Few Seconds</h2><i class="fa fa-refresh fa-spin fa-3x fa-fw margin-bottom"></i>');
        //start the chain of api calls
        buildPage();
      }
    }, function(error){
      console.log('error with authentication');
      console.log(error);
    });

  }else{
    //if we don't have a code to process through, then show the login page with
    //event handler to listen for login button or user search
    drawLoading();
  }
}

//setup the initial loading window if we aren't authenticated
//the event handler here initializes the page load if the user gives us a username
function drawLoading( ){
  //output loading screen template
  $('.loading-login-inner').html( loading );
  //attach event handlers to login UI elements

  $('#user-search-submit').click(function(event){
    //handle unauthenticated user search
    gitLogin = $('#user-search-input')[0].value;
    if(gitLogin !== undefined){
      $.ajaxSetup({
        headers: {
          // 'Authorization': 'token ' + cache.token,
          'Accept': 'application/vnd.github.drax-preview+json'
        }
      });
      verifyLogin('login');
    }
  });

  //go to github to get stage 1 OAuth code
  $('#github-login').click(function(event){
    $.ajax('http://github-clone.herokuapp.com/client-id').then(function(data){
      var client_id = data;
      window.location.replace('https://github.com/login/oauth/authorize?client_id='+client_id+'&scope=repo');
    }, function(error){
      console.log('error getting client ID', error);
    })
  });
}


//------------------------------------------------------------------------------
//               BUILD OUR DATA OBJECTS FROM THE API ENDPOINTS
//------------------------------------------------------------------------------
//check to see if a username we're given is valid before we run our full
//list of API calls
function verifyLogin( source ){
  userURL = 'https://api.github.com/users/' + gitLogin;
  $.ajax(userURL).done(function(data){
    $('#loading-login').css("bottom", "0");
    $('.loading-login-inner').html('<h2>Loading Your Page This Can Take a Few Seconds</h2><i class="fa fa-refresh fa-spin fa-3x fa-fw margin-bottom"></i>');
    //set new repo to inactive
    buildPage();
  }).fail(function(jqXHR, status, error){
    newrepoReturned = jqXHR;
    if(source == 'search'){
      // console.log($('#hla-search-bar'));
      document.querySelector('#hla-search-bar').value = 'Not A Valid Login';
    }else if( source == 'login'){
      // console.log($('#user-search-input'));
      document.querySelector('#user-search-input').value = 'Not A Valid Login';
    }
  });
}

//get a user's data (public or private depending on our authentication)
//entry point for our page once we have an auth token
function buildPage(){
  if(loggedIn){
    userURL = 'https://api.github.com/user';
  }else{
    userURL = 'https://api.github.com/users/' + gitLogin;
  }
  $.ajax(userURL).done(function(data){
    userReturn = prettyDate(data);
    getGitIgnores();  //ajax call to organizations api endpoint
  });
}

//get the list of gitignore templates to populate the new repo form
function getGitIgnores(){
  var gitUrl = 'https://api.github.com/gitignore/templates';
  $.ajax(gitUrl).done(function(data){
    userReturn.gitignores = data;
    getLicenses();
  });
}

//get the list of license templates to populate the new repo form
function getLicenses(){
  var licenseUrl = 'https://api.github.com/licenses';
  $.ajax(licenseUrl).done(function(data){
    userReturn.licenses = data;
    getOrgs();
  });
}

//get a detailed list of organizations for the user
function getOrgs(){
  if(loggedIn){
    orgsUrl = 'https://api.github.com/user/orgs';
  }else{
    orgsUrl = 'https://api.github.com/users/' + gitLogin + '/orgs';
  }
  $.ajax(orgsUrl).done(function(data){
    userReturn.organizations = data;
    getRepos();  //ajax call to repos api endpoint
  });
}

//get the list of repositories for this user
function getRepos(){
  var repoUrl = 'https://api.github.com/users/' + userReturn.login + '/repos';
  $.ajax(repoUrl).done(function(data){
    reposReturned = data;
    recurseRepos(reposReturned, 0);
    //recurseRepos recursively does an ajax call to the individual
    //repo api endpoint for each repo we retrieved to get more indepth
    //data for those repos
  });
}

//go through our list of repositories and get the full data for each one
function recurseRepos(repoArr, counter){
  if(counter < repoArr.length){
    var recurseUrl = 'https://api.github.com/repos/' + repoArr[counter].full_name;
    $.ajax(recurseUrl).done(function(data){
      repoArr[counter] = data;
      counter ++;
      recurseRepos(repoArr, counter);
    });
  }else{
    //if we've gotten through the entire array of repos, then do another
    //call through our array to get statistics for them as well with
    //recurseRepoStats
    counter = 0;
    reposReturned = repoArr;
    recurseRepoStats(repoArr, counter);
  }
}

//get the commit statistics for each repo on our list
function recurseRepoStats(repoArr, counter){
    //until we've gotten through each repo we just keep calling for more data
    if(counter< repoArr.length){
        var repoStats = 'https://api.github.com/repos/' + repoArr[counter].full_name + '/stats/participation';
        $.ajax(repoStats).done(function(data){
          repoArr[counter].participation = data;
          counter ++;
          recurseRepoStats(repoArr, counter);
        });
    }else{
      //once we've gone through everything
      //set our global repo variable we pass into the Handlebars template
      reposReturned = repoArr;
      drawPage();
      // console.log(userReturn);
      // console.log(reposReturned);
    }
}

//now that all the data is set, we format a few
//fields, sort and populate the templates
function drawPage(){
  reposReturned.forEach(function( item ){
    var dateFrom = timeSince( item.updated_at );
    item.time = dateFrom[0];
    item.period = dateFrom[1];
    item.secondsSince = dateFrom[2];
  });
  reposReturned =  _.sortBy(reposReturned, 'secondsSince');
  //set our global flag to tell other functions we have loaded our data
  repoLoaded = true;
  //send our data out to populate the templates
  drawHeader(userReturn);
  drawSidebar(userReturn);
  drawNewRepoModal(userReturn);
  drawRepos(reposReturned);
  //hide loading screen
  $('#loading-login').css("bottom", "100%");
  //now we wait for an event to trigger!
}

//------------------------------------------------------------------------------
//                 TEMPLATE FUNCTIONS CALLED ON AJAX COMPLETION
//------------------------------------------------------------------------------
function drawHeader(data){
  //load template onto page
  var headerHTML = header(data);
  $('header').html(headerHTML);

  //javascript to control dropdowns (done without bootstrap)
  $('#hra-profile, #hra-create-new').click(function(){
    dropDownClick(this);
  });
  $('#new-repo-dd').click(function(event){
    event.preventDefault();
    $('.bs-example-modal-lg').modal('toggle');
  });

  //handle input if user searches for a new username with top field
  $('#hla-search-bar').on('keyup', function(event){
    if(event.which == 13){
      gitLogin = $(this)[0].value;
      if(gitLogin !== undefined){
        $.ajaxSetup({
          headers: {
            'Accept': 'application/vnd.github.drax-preview+json'
          }
        });
        verifyLogin('search');
      }
    }
  });

  //handle logout and reset page status to start
  $('#logout').click(function(event){
    event.preventDefault();
    $.ajaxSetup({
      headers: {}
    });
    $('#loading-login').css("bottom", "0");
    loggedIn = false;
    gitLogin = '';
    drawLoading();
  });
}

function drawSidebar(data){
  //parse context into template
  var sidebarHTML = sidebar(data);
  //insert into DOM
  $('#user-info').html(sidebarHTML);
}

function drawRepos(data){
  var repoHTML = repos({'repos': data});
  $('#repo-listings').html(repoHTML);
  //show or hide new repo UI button if we are logged in
  if(loggedIn){
    $('#new-repo').css('display', 'inline-block');
  }else{
    $('#new-repo').css('display', 'none');
  }
}

//build the modal window out for new repository form
function drawNewRepoModal(data){
  var newRepoHTML = newrepo(data);
  $('.modal-content').html(newRepoHTML);
  setDropDownEvents(['gitig', 'lic']);
  //handle form submission for new repository
  $('#new-repo-submit').click(function(event){
    //get form values
    var repoName = $('#new-repo-name')[0].value;
    var repoDesc = $('#repo-desc')[0].value;
    var repoPubPriv = $('.new-repo-pub-priv');
    var repoInit = $('#git-init');
    var repoGitIg = $('#repo-gitig');
    var repoLicense = $('#repo-lic');
    repoPubPriv = _.filter(repoPubPriv, 'checked');
    if(repoPubPriv.value == 'private'){
      repoPubPriv = true;
    }else{
      repoPubPriv = false;
    }
    repoInit = repoInit.checked;
    if(repoGitIg[0].hasOwnProperty( 'attributes.gitig.value' ) ){
      repoGitIg = repoGitIg[0].attributes.gitig.value;
    }else{
      repoGitIg = "";
    }
    if(repoLicense[0].hasOwnProperty( 'attributes.lic.value' ) ){
      repoLicense = repoLicense[0].attributes.lic.value;
    }else{
      repoLicense = "";
    }
    var newRepoURL = 'https://api.github.com/user/repos';
    //send POST request to create a new repo
    $.ajax({
      "url": newRepoURL,
      "method": "POST",
      "contentType": "application/json",
      "dataType": "json",
      "data": JSON.stringify({ "name": repoName, "description": repoDesc, "private":repoPubPriv, "auto_init": repoInit, "gitignore_template": repoGitIg, "license_template": repoLicense})
    }).done(function(data){
      //on successful upload add this repo to our existing list and add it
      //also send success message to our modal window to alert the user
      newrepoReturned = data;
      drawRepoResult(newrepoReturned);
      var dateFrom = timeSince( newrepoReturned.updated_at );
      newrepoReturned.time = dateFrom[0];
      newrepoReturned.period = dateFrom[1];
      newrepoReturned.secondsSince = dateFrom[2];
      reposReturned.push(newrepoReturned);
      reposReturned = _.sortBy(reposReturned, 'secondsSince');
      drawRepos(reposReturned);
    }).fail(function(jqXHR, status, error){
      //on failure provide message to the user
      newrepoReturned = jqXHR;
      drawRepoResult(newrepoReturned);
    });
  });
}

//populate new repo modal with success or failure info
function drawRepoResult(data){
  var repoSuccessHTML = reposuccess(data);
  $('.modal-content').html(repoSuccessHTML);
}

//------------------------------------------------------------------------------
//              UTILITY FUNCTIONS USED TO FORMAT OR SORT DATA
//------------------------------------------------------------------------------
//format Joined on Date for Profile Sidebar
function prettyDate(data){
  var date = new Date(data.created_at);
  data.pretty_date = monthNames[date.getMonth()] + " " + date.getDate() + ", " + date.getFullYear();
  return data;
}

//from stackoverflow by rob updating from Sky Sanders
//http://stackoverflow.com/questions/3177836/how-to-format-time-since-xxx-e-g-4-minutes-ago-similar-to-stack-exchange-site/23259289#23259289
function timeSince(date) {
    if (typeof date !== 'object') {
        date = new Date(date);
    }
    var seconds = Math.floor((new Date() - date) / 1000);
    var intervalType;
    var interval = Math.floor(seconds / 31536000);
    if (interval >= 1) {
        intervalType = 'year';
    } else {
        interval = Math.floor(seconds / 2592000);
        if (interval >= 1) {
            intervalType = 'month';
        } else {
            interval = Math.floor(seconds / 86400);
            if (interval >= 1) {
                intervalType = 'day';
            } else {
                interval = Math.floor(seconds / 3600);
                if (interval >= 1) {
                    intervalType = "hour";
                } else {
                    interval = Math.floor(seconds / 60);
                    if (interval >= 1) {
                        intervalType = "minute";
                    } else {
                        interval = seconds;
                        intervalType = "second";
                    }
                }
            }
        }
    }
    if (interval > 1 || interval === 0) {
        intervalType += 's';
    }
    return [interval, intervalType, seconds];
}

//provide sort value for filtering repos with sort bar
function switchSort(sort, item){
  switch (sort) {
    case 'public':
      if(item.private === false){
        return true;
      }else{
        return false;
      }
      break;
    case 'private':
      if(item.private === true){
        return true;
      }else{
        return false;
      }
      break;
    case 'source':
      if(item.fork === true){
        return false;
      }else{
        return true;
      }
      break;
    case 'fork':
      if(item.fork === true){
        return true;
      }else{
        return false;
      }
      break;
    case 'mirror_url':
      if(item.mirror_url === null){
        return false;
      }else{
        return true;
      }
      break;
  }
}

//------------------------------------------------------------------------------
//         EVENT HANDLERS WITH ELEMENTS NOT LOADED BY TEMPLATES
//------------------------------------------------------------------------------
//EVENT HANDLER FOR THE SORT OPTIONS OF THE REPO TAB
$('.repo-sort-option').click(function(event){
    event.preventDefault();
    repoSort = event.currentTarget.attributes.value.value;
    if(repoLoaded){
      if(repoSort === undefined || repoSort == 'all' ){
         sortRepos = _.sortBy(reposReturned, 'secondsSince');
      }else{
        sortRepos = _.filter(reposReturned, function(item){
          return switchSort(repoSort, item);
        });
      }
      drawRepos(sortRepos);
    }
});

//EVENT HANDLER FOR SEARCH INPUT ON THE REPO TAB
$('#repo-search-input').on('keyup', function(event){
  var searchTerm = event.currentTarget.value;
  if(repoLoaded){
    if(sortRepos !== undefined){
      searchRepos = sortRepos;
    }else{
      searchRepos = reposReturned;
    }
    var searchedRepos = _.filter(searchRepos, function(item){
      if(item.name.indexOf(searchTerm) > -1){
        return true;
      }else{
        return false;
      }
    });
    drawRepos(searchedRepos);
  }
});
//EVENT HANDLER TO RESET NEW REPO FORM ON OPENING
$('#new-repo').click(function(event){
  if(userReturn && loggedIn){
    drawNewRepoModal(userReturn);
  }
});

//------------------------------------------------------------------------------
//                     EVENT HANDLER CALLBACK FUNCTIONS
//      THESE ARE CALLED ONCE OUR TEMPLATES LOAD THE RESPECTIVE ELEMENTS
//------------------------------------------------------------------------------

function dropDownClick( clicked ){
  if($(clicked).find('ul').css('display') == 'none'){
    $(clicked).find('ul').css({'display': 'inline-block'});
  }else{
    $(clicked).find('ul').css({'display': 'none'});
  }
}
//EVENT HANDLER TO POPULATE AND LISTEN FOR DROPDOWNS USED
//ON THE NEW REPOSITORY FORM
function setDropDownEvents(array){
  array.forEach(function(item){
    var strOne = '#repo-' + item + '-list li a';
    $(strOne).click(function(event){
      var valSelected = event.currentTarget.attributes.value.value;
      var valDisplay = event.currentTarget.text;
      $(strOne).removeClass('dd-selected');
      $(event.currentTarget).addClass('dd-selected');
      $('#repo-' + item + ' .repo-' + item + '-display').text(valDisplay);
      $('#repo-' + item ).attr( item, valSelected );
    });
  });
}
