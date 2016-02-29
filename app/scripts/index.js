//to get authentication to work cd into the gatekeeper folder and run: node server.js
//then run the site as normal through npm run watch, will have to update
//the application redirect URL with github if the npm server has a different port
//------------------------------------------------------------------------------
//                        LIBRARIES
//------------------------------------------------------------------------------
var $;
window.jQuery = $ = require('jquery');
var _ = require('underscore');
var Handlebars = require('handlebars/runtime')['default'];
var bootstrap = require('bootstrap-sass/assets/javascripts/bootstrap.min.js');

//CACHED DATA USED DURING DEVELOPMENT SO WE DON'T HAVE TO CALL THE API
//EVERY TIME WE UPDATE CSS OR HTML FILES
var cache = require('./cached-data.js');
//SETUP GLOBAL VARIABLES FOR OUR APP
var githubtoken = cache.token;
var userReturn = cache.userReturn;
var reposReturned = cache.repos;
var newrepoReturned = cache.newrepo;
var gitignores = cache.gitignores;
var licenses = cache.licenses;
var monthNames = ["January", "February", "March","April", "May", "June","July", "August", "September","October", "November", "December"];
var orgs, user_info, repoSort, repoLoaded, data, sortRepos, searchRepos;
var clientID = cache.clientID;
var clientSecret = cache.clientSecret;
var oAuthURL = 'https://github.com/login/oauth/authorize';
var loggedIn = false;

//HANDLEBARS TEMPLATE HELPER FUNCTIONS
Handlebars.registerHelper('scale-bar', function( object, scale ) {
  return new Handlebars.SafeString( object * scale );
});
Handlebars.registerHelper('percent-offset', function(object) {
  return new Handlebars.SafeString( object / 52 * 100 );
});

if(document.URL.indexOf('?code=') > -1){
  var code = document.URL.match(/\?code=(.*)/);
  $.getJSON('http://localhost:9999/authenticate/'+code[1], function(data) {
    // SET OUR AUTH TOKEN IN THE HEADER OF OUR API REQUESTS
    if(typeof(data.token) !== "undefined"){
      $.ajaxSetup({
        headers: {
          'Authorization': 'token ' + data.token
        }
      });
      // console.log(window);
      $('.loading-login-inner').html('<h2>Loading Your Page This Can Take a Few Seconds</h2><i class="fa fa-refresh fa-spin fa-3x fa-fw margin-bottom"></i>');
      buildPage();
    }
  });
}else{
  oAuthLogin();
}

function oAuthLogin(){
  $('#github-login').click(function(event){
    window.location.replace('https://github.com/login/oauth/authorize?client_id='+clientID+'&scope=repo');
  });
}

//------------------------------------------------------------------------------
//                        TEMPLATE IMPORTS
//------------------------------------------------------------------------------
var header = require('./header.handlebars');
var sidebar = require('./sidebar.handlebars');
var repos = require('./repos.handlebars');
var newrepo = require('./newrepo.handlebars');
var reposuccess = require('./reposuccess.handlebars');

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
  if(userReturn){
    drawNewRepoModal(userReturn);
  }
});


//------------------------------------------------------------------------------
//                     EVENT HANDLER CALLBACK FUNCTIONS
//      THESE ARE CALLED ONCE OUR TEMPLATES LOAD THE RESPECTIVE ELEMENTS
//------------------------------------------------------------------------------
function clearHover(clicked){
  $(clicked).find('.hra-hover-box').css({'display': 'none'});
}
function dropDownClick( clicked ){
  if($(clicked).find('ul').css('display') == 'none'){
    $(clicked).find('ul').css({'display': 'inline-block'});
  }else{
    $(clicked).find('ul').css({'display': 'none'});
  }
  clearHover(clicked);
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
//------------------------------------------------------------------------------
//               BUILD OUR DATA OBJECTS FROM THE API ENDPOINTS
//                  AND THEN LOAD OUR PAGE FROM TEMPLATES
//------------------------------------------------------------------------------
//entry point for our page once we have an auth token
function buildPage(){
  var authURL = 'https://api.github.com/user';
  $.ajax(authURL).done(function(data){
    userReturn = prettyDate(data);
    getOrgs();  //ajax call to organizations api endpoint
  });
}

function getOrgs(){
  var orgsUrl = 'https://api.github.com/user/orgs';
  $.ajax(orgsUrl).done(function(data){
    userReturn.organizations = data;
    getRepos();  //ajax call to repos api endpoint
  });
}

function getRepos(){
  var repoUrl = 'https://api.github.com/users/' + userReturn.login + '/repos';
  $.ajax(repoUrl).done(function(data){
    reposReturned = data;
    reposReturned.forEach(function( item ){
      var dateFrom = timeSince( item.updated_at );
      item.time = dateFrom[0];
      item.period = dateFrom[1];
      item.secondsSince = dateFrom[2];
    });
    reposReturned =  _.sortBy(reposReturned, 'secondsSince');
    recurseRepos(reposReturned, 0);
    //recurseRepos recursively does an ajax call to the individual
    //repo api endpoint for each repo we retrieved to get more indepth
    //data for those repos
  });
}

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

function recurseRepoStats(repoArr, counter){
    if(counter< repoArr.length){
        var repoStats = 'https://api.github.com/repos/' + repoArr[counter].full_name + '/stats/participation';
        $.ajax(repoStats).done(function(data){
          repoArr[counter].participation = data;
          counter ++;
          recurseRepoStats(repoArr, counter);
        });
    }else{
      //set our global repo variable we pass into the Handlebars template
      reposReturned = repoArr;
      //set our global flag to tell other functions we have loaded our data
      repoLoaded = true;
      //send our data out to populate the templates
      drawHeader(userReturn);
      drawSidebar(userReturn);
      drawNewRepoModal(userReturn);
      drawRepos(reposReturned);
      $('#loading-login').css("bottom", "100%");
    }
}

// var url = 'https://api.github.com/users/dalevfenton';
// if(source==='api'){
//   $.ajax(url).
//     done(function(data){
//       userReturn = data;
//       userReturn = prettyDate(userReturn);
//       drawHeader(userReturn);
//       var orgsUrl = 'https://api.github.com/user/orgs';
//       $.ajax(orgsUrl).done(function(data){
//         user_info.organizations = data;
//         // console.log(user_info);
//         drawSidebar(userReturn);
//         drawNewRepoModal(userReturn);
//         var repoUrl = 'https://api.github.com/users/' + userReturn.login + '/repos';
//         $.ajax(repoUrl).done(function(data){
//           var index = 0;
//           // console.log(data);
//           reposReturned = data;
//           reposReturned.forEach(function( item ){
//             var dateFrom = timeSince( item.updated_at );
//             item.time = dateFrom[0];
//             item.period = dateFrom[1];
//             item.secondsSince = dateFrom[2];
//           });
//           reposReturned =  _.sortBy(reposReturned, 'secondsSince');
//           recurseRepos(reposReturned, index);
//         });
//       });
//   })
//   .fail(function(jqXHR, status, error){
//     console.log(jqXHR);
//     console.log(status);
//     console.log(error);
//   });
// }else{
//   userReturn = prettyDate(userReturn);
//   reposReturned.forEach(function( item ){
//     var dateFrom = timeSince( item.updated_at );
//     item.time = dateFrom[0];
//     item.period = dateFrom[1];
//     item.secondsSince = dateFrom[2];
//   });
//   reposReturned = _.sortBy(reposReturned, 'secondsSince');
//   repoLoaded = true;
//   drawHeader(userReturn);
//   drawSidebar(userReturn);
//   drawRepos(reposReturned);
//   userReturn.licenses = licenses;
//   userReturn.gitignores = gitignores;
//   drawNewRepoModal(userReturn);
//   //EVENT HANDLER FOR GITHUB LOGIN WITH OAUTH
//   oAuthLogin();
//
// }


//------------------------------------------------------------------------------
//                 TEMPLATE FUNCTIONS CALLED ON AJAX COMPLETION
//------------------------------------------------------------------------------
function drawHeader(data){
  var headerHTML = header(data);
  $('header').html(headerHTML);
  $('#hra-profile, #hra-create-new').click(function(){
    dropDownClick(this);
  });
  // $('#hra-profile, #hra-create-new').on('mouseover', function(){
  //     $(this).find('.hra-hover-box').css({'display': 'block'});
  // });
  // $('#hra-profile, #hra-create-new').on('mouseout', function(){
  //     clearHover(this);
  // });
  $('#new-repo-dd').click(function(event){
    event.preventDefault();
    $('.bs-example-modal-lg').modal('toggle');
  });
  $('#logout').click(function(event){
    event.preventDefault();
    $.ajaxSetup({
      headers: {}
    });
    $('.loading-login-inner').html('<button type="button" id="github-login" class="btn btn-success"><span class="glyphicon glyphicon-book" aria-hidden="true"></span> Login To Your GitHub Account</button>');
    $('#loading-login').css("bottom", "0");
    oAuthLogin();
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
}

function drawNewRepoModal(data){
  var newRepoHTML = newrepo(data);
  $('.modal-content').html(newRepoHTML);
  setDropDownEvents(['gitig', 'lic']);
  $('#new-repo-submit').click(function(event){
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
    $.ajax({
      "url": newRepoURL,
      "method": "POST",
      "contentType": "application/json",
      "dataType": "json",
      "data": JSON.stringify({ "name": repoName, "description": repoDesc, "private":repoPubPriv, "auto_init": repoInit, "gitignore_template": repoGitIg, "license_template": repoLicense})
    }).done(function(data){
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
      newrepoReturned = jqXHR;
      // console.log(jqXHR);
      // console.log(status);
      // console.log(error);
      drawRepoResult(newrepoReturned);
    });
  });
}

function drawRepoResult(data){
  var repoSuccessHTML = reposuccess(data);
  $('.modal-content').html(repoSuccessHTML);
}

function prettyDate(data){
  var date = new Date(data.created_at);
  data.pretty_date = monthNames[date.getMonth()] + " " + date.getDate() + ", " + date.getFullYear();
  return data;
}

//------------------------------------------------------------------------------
//              UTILITY FUNCTIONS USED TO FORMAT OR SORT DATA
//------------------------------------------------------------------------------
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
