var $ = require('jquery');
var _ = require('underscore');
var Handlebars = require('handlebars');
var githubtoken = require('./githubtoken.js').token;
var userReturn = require('./githubtoken.js').userReturn;
var reposReturned = require('./githubtoken.js').repos;
var source = 'cache';
var monthNames = ["January", "February", "March","April", "May", "June","July", "August", "September","October", "November", "December"];

var orgs, user_info;
if(typeof(githubtoken) !== "undefined"){
  $.ajaxSetup({
    headers: {
      'Authorization': 'token ' + githubtoken,
    }
  });
}
//------------------------------------------------------------------------------
//                        TEMPLATE IMPORTS
//------------------------------------------------------------------------------
//grab the header template for use
var header = require('./header.handlebars');
var sidebar = require('./sidebar.handlebars');
//build context obj

//------------------------------------------------------------------------------
//                        BUILD CONTEXT OBJECTS
//------------------------------------------------------------------------------




//------------------------------------------------------------------------------
//                        INTERACTIVE EVENT HANDLERS
//------------------------------------------------------------------------------
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
      user_info = data;
      user_info = prettyDate(user_info);
      drawHeader(user_info);
      var orgsUrl = 'https://api.github.com/user/orgs';
      $.ajax(orgsUrl).done(function(data){
        user_info.organizations = data;
        // console.log(user_info);
        drawSidebar(user_info);
        var repoUrl = 'https://api.github.com/users/dalevfenton/repos';
        var repoUrlFull = 'https://api.github.com/repos/dalevfenton/generator-tiy-gvl-feb-2016';
        $.ajax(repoUrl).done(function(data){
          var index = 0;
          // console.log(data);
          reposReturned = data;
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
  user_info = prettyDate(userReturn);
  drawHeader(user_info);
  drawSidebar(user_info);
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
    // drawRepos(repoArr);
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
  var repoHTML = repo(data);
  $('#repo-listings').html(repoHTML);
}
function prettyDate(data){
  var date = new Date(data.created_at);
  data.pretty_date = monthNames[date.getMonth()] + " " + date.getDate() + ", " + date.getFullYear();
  return data;
}
