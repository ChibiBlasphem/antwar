'use strict';
var _ = require('lodash');

var themeFunctions = require('theme/functions') || {};

var MdHelper = require('./elements/MdHelper');
var postHooks = require('./postHooks');
var config = require('config');
var siteFunctions = config.functions || {} ;
var he = require('he');

function allPosts() {
  var returnObj = {};

  var posts = [].concat.apply([], _.keys(config.paths).map(function(k) {
    var v = config.paths[k];
    var modules = v.path();
    var paths = _.map(modules.keys(), function(name) {
      return [
        k + '/' + name.slice(2),
        {
          path: k,
          file: modules(name),
          // TODO: push these into an object?
          url: v.url,
          date: v.date,
          content: v.content,
          preview: v.preview,
          title: v.title,
        },
      ];
    });

    return (v.sort || id)(paths);
  }));

  // TODO: check config.drafts
  var drafts = [];

  // Include drafts if we're not in prod
  /*
  var drafts = [];
  if(__DEV__) {
    var draftModules = draftReq();

    if(draftModules) {
      drafts = _.map(draftModules.keys(), function(name) {
        return [
          name,
          _.assign({draft: true}, draftModules(name)),
        ];
      });
    }
  }*/

  posts = postHooks.preProcessPosts(posts);

  // Build some nice objects from the files
  _.each(posts.concat(drafts), function(fileArr) {
    var o = fileArr[1];
    var fileName = fileArr[0].slice(2); // remove the './'

    var processedFile = processPost(
      o,
      fileName
    );

    returnObj[processedFile.url] = processedFile;
  });
  returnObj = postHooks.postProcessPosts(returnObj);

  return returnObj;
}
exports.allPosts = allPosts;

function allPages() {
  // TODO: allow hooks on page processing
  var req = pageReq();
  var pages = {};

  _.each(req.keys(), function(name) {
    // name is format ./url_title.ext
    var file = req(name); // require the file
    var fileName = name.slice(2); // remove the './'

    var content = renderContent(file);

    // url is filename minus extension
    var url = _.kebabCase(fileName.split('.')[0]);

    // title is the capitalized url
    var title = _.capitalize(url.replace(/\-/g, ' '));

    // rewrite the index file
    if(url === 'index') {
      url = '/';
    }

    pages[url] = {
      url: url,
      fileName: fileName,
      title: title,
      content: content,
    };
  });
  pages = postHooks.postProcessPages(pages);
  return pages;
}
exports.allPages = allPages;

function postForPath(path) {
  return allPosts()[path];
}
exports.postForPath = postForPath;

function pageForPath(path) {
  return allPages()[path];
}
exports.pageForPath = pageForPath;

function pageReq() {
  return require.context('pages', false);
}
exports.pageReq = pageReq;

function renderContent(content) {
  return MdHelper.render(content);
}
exports.renderContent = renderContent;

function processPost(o, fileName) {
  var file = o.file;

  var functions = _.assign({
    url: function(file, fileName) {
      return fileName.slice(0, fileName.length - 3);
    },
    date: function(file, fileName) {
      return file.date || fileName.slice(0, 10);
    },
    content: function(file, fileName) {
      return MdHelper.render(file.__content);
    },
    preview: function(file, fileName) {
      if (file.preview) {
        return file.preview;
      }
      else {
        var stripped = he.decode(file.content.replace(/<(?:.|\n)*?>/gm, ''));
        if (stripped.length > 100) {
          return stripped.substr(0, 100) + '…';
        }
        else {
          return stripped;
        }
      }
      return file.preview || MdHelper.getContentPreview(file.__content);
    },
    title: function(file, fileName) {
      return file.title;
    }
  }, themeFunctions, siteFunctions);

  _.forEach(functions, function(fn, name) {
    file[name] = (o[name] || fn)(file, fileName);
  });

  // no need to transform root path
  file.path = o.path;

  return file;
}

function id(a) {return a;}
