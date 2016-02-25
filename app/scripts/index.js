var $ = require('jquery');
var _ = require('underscore');
var Handlebars = require('handlebars');

var header = require('./header.handlebars');
console.log(header);

var context = {'title': 'this is the title', 'author': 'Dale Fenton', 'third_field':'more stuff goes here'};
var html = header(context);
$('body h1').html(html);
//update
