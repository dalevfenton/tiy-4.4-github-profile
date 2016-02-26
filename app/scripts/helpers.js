Handlebars.registerHelper('timesten', function(object) {
  return new Handlebars.SafeString( object * 10 );
});
