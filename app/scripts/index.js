//------------------------------------------------------------------------------
//                        HANDLEBAR HELPERS
//------------------------------------------------------------------------------
var $ = require('jquery');
var _ = require('underscore');
var Handlebars = require('handlebars/runtime')['default'];
                  // require('./helpers.js');
var cache = require('./cached-data.js');
var githubtoken = cache.token;
var userReturn = cache.userReturn;
var reposReturned = cache.repos;
var monthNames = ["January", "February", "March","April", "May", "June","July", "August", "September","October", "November", "December"];
var orgs, user_info, repoSort, repoLoaded, data, sortRepos, searchRepos;

Handlebars.registerHelper('times-ten', function( object ) {
  return new Handlebars.SafeString( object * 1.25 );
});
Handlebars.registerHelper('percent-offset', function(object) {
  return new Handlebars.SafeString( object / 52 * 100 );
});
//setup headers to do authentication with github using personal token
if(typeof(githubtoken) !== "undefined"){
  $.ajaxSetup({
    headers: {
      'Authorization': 'token ' + githubtoken,
    }
  });
}



//flag that can be set to api to use live api calls or cache to use cached data
//so that our usage and refresh time are low
var source = 'cache';
//------------------------------------------------------------------------------
//                        TEMPLATE IMPORTS
//------------------------------------------------------------------------------
//grab the header template for use
var header = require('./header.handlebars');
var sidebar = require('./sidebar.handlebars');
var repos = require('./repos.handlebars');
//build context obj
//------------------------------------------------------------------------------
//                        BUILD CONTEXT OBJECTS
//------------------------------------------------------------------------------




//------------------------------------------------------------------------------
//                        INTERACTIVE EVENT HANDLERS
//------------------------------------------------------------------------------
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
$('#repo-search-input').on('keyup', function(event){
  // console.log(event);
  console.log(event.currentTarget.value);
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
//------------------------------------------------------------------------------
//                  EVENT HANDLER CALLBACK FUNCTIONS
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
//------------------------------------------------------------------------------
//                  RUN THE APP
//------------------------------------------------------------------------------
var url = 'https://api.github.com/users/dalevfenton';
if(source==='api'){
  $.ajax(url).
    done(function(data){
      userReturn = data;
      userReturn = prettyDate(userReturn);
      drawHeader(userReturn);
      var orgsUrl = 'https://api.github.com/user/orgs';
      $.ajax(orgsUrl).done(function(data){
        user_info.organizations = data;
        // console.log(user_info);
        drawSidebar(userReturn);
        var repoUrl = 'https://api.github.com/users/' + userReturn.login + '/repos';
        $.ajax(repoUrl).done(function(data){
          var index = 0;
          // console.log(data);
          reposReturned = data;
          reposReturned.forEach(function( item ){
            var dateFrom = timeSince( item.updated_at );
            item.time = dateFrom[0];
            item.period = dateFrom[1];
            item.secondsSince = dateFrom[2];
          });
          reposReturned =  _.sortBy(reposReturned, 'secondsSince');
          recurseRepos(reposReturned, index);
        });
      });
  })
  .fail(function(jqXHR, status, error){
    console.log(jqXHR);
    console.log(status);
    console.log(error);
  });
}else{
  userReturn = prettyDate(userReturn);
  reposReturned.forEach(function( item ){
    var dateFrom = timeSince( item.updated_at );
    item.time = dateFrom[0];
    item.period = dateFrom[1];
    item.secondsSince = dateFrom[2];
  });
  reposReturned = _.sortBy(reposReturned, 'secondsSince');
  repoLoaded = true;
  drawHeader(userReturn);
  drawSidebar(userReturn);
  drawRepos(reposReturned);
  // drawRepos(reposReturned);
}

function recurseRepos(repoArr, counter){
  if(counter < repoArr.length){
    var recurseUrl = 'https://api.github.com/repos/' + repoArr[counter].full_name;
    $.ajax(recurseUrl).done(function(data){
      // console.log(data);
      repoArr[counter] = data;
      counter ++;
      recurseRepos(repoArr, counter);
    });
  }else{
    // console.log('repo recursion done');
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
      console.log(repoArr);
      reposReturned = repoArr;
      repoLoaded = true;
      drawRepos(reposReturned);
    }
}
//------------------------------------------------------------------------------
//                 TEMPLATE FUNCTIONS CALLED ON AJAX COMPLETION
//------------------------------------------------------------------------------
function drawHeader(data){
  var headerHTML = header(data);
  $('header').html(headerHTML);
  $('#hra-profile, #hra-create-new').click(function(){
    dropDownClick(this);
  });
  $('#hra-profile, #hra-create-new').on('mouseover', function(){
    // window.preventDefault();
      $(this).find('.hra-hover-box').css({'display': 'block'});
  });
  $('#hra-profile, #hra-create-new').on('mouseout', function(){
    // window.preventDefault();
      clearHover(this);
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
