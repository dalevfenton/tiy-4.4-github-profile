var $ = require('jquery');
var _ = require('underscore');
var Handlebars = require('handlebars');

//grab the header template for use
var header = require('./header.handlebars');
//build context obj
var context = {'username': 'dalevfenton', 'avatar_url': ''};
//parse context into template
var html = header(context);
//insert into DOM
$('header').html(html);

$('#hra-profile, #hra-create-new').click(function(){
  // window.preventDefault();
  dropDownClick(this);
});
function dropDownClick( clicked ){
  if($(clicked).find('ul').css('display') == 'none'){
    $(clicked).find('ul').css({'display': 'inline-block'});
  }else{
    $(clicked).find('ul').css({'display': 'none'});
  }
  clearHover(clicked);
}
$('#hra-profile, #hra-create-new').on('mouseover', function(){
  // window.preventDefault();
    $(this).find('.hra-hover-box').css({'display': 'block'});
});
$('#hra-profile, #hra-create-new').on('mouseout', function(){
  // window.preventDefault();
    clearHover(this);
});
function clearHover(clicked){
  $(clicked).find('.hra-hover-box').css({'display': 'none'});
}
