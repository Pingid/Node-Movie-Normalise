var fs = require('fs');
var path = require('path');
var fetch = require('node-fetch');
var cheerio = require("cheerio");

// General util functions
function l(str) { return console.log(JSON.stringify(str, null, 2)) }
Array.prototype.flatten = function() {
  var newArr = [];
  function loop(arr) {
    return arr.forEach(function(item) {
      if (Array.isArray(item)) return loop(item);
      return newArr.push(item);
    });
  }
  loop(this);
  return newArr;
}

// Spesific util functions
var match_video_files = /\.(?:3g2|3gp|asf|asx|avi|flv|m4v|mkv|mov|mp4|mpg|rm|swf|vob|wmv)$/i;
function isVideoFile(path) { return match_video_files.test(path) }
function isDir(path) { return fs.lstatSync(path).isDirectory() }
function extractInfo(pathName) {
  var fileName = path.parse(pathName).base;
  var split = /(.*?)(?:[\[\(])*([0-9]{4})(.*)/.exec(fileName);
  var name = split[1].split('.').join(' ').trim();
  var year = split[2]
  return { pathName: pathName, name: name, year: year };
}

function addNewName(file) {
  var newName = file.name + ' [' + file.year + '] ' + 'C-' + file.tomatometer + '% ' + 'A-' + file.audience + '%';
  var parsed = path.parse(file.pathName);
  var renamedFolder = parsed.dir.split('/').map(function(name) {
    if (new RegExp(file.year).test(name)) return newName;
    return name;
  }).join('/');
  var newFileName = path.join(renamedFolder, newName + parsed.ext)
  return Object.assign({}, file, {
    newDirName: renamedFolder,
    newFileName: newFileName
  });
}

function getAllFileNames(prev, name) {
  var filePath = path.join(prev.join('/'), name);
  if (isDir(filePath)) {
    return fs.readdirSync(filePath).map(function(file) {
      return getAllFileNames([].concat(prev, [name]), file)
    })
  }
  return filePath
}

function getScores(file) {
  var name = file.name.split(' ').join('_');
  return fetch('http://www.rottentomatoes.com/m/' + name)
    .then(function(res) { return res.text() })
    .then(function(res) {
      var $ = cheerio.load(res);
      var scores = $('.meter-value').map(function(index, el) {
        return cheerio(el).text();
      });
      return Object.assign({}, file, {
        tomatometer: scores[0].trim().replace('%', ''),
        audience: scores[2].trim().replace('%', '')
      })
    })
}

// Main function
function renameFiles() {
  var allVideoFiles = getAllFileNames([], __dirname).flatten().filter(isVideoFile).map(extractInfo);
  return allVideoFiles.map(function(file) {
    return getScores(file)
      .then(addNewName)
      .then(function(f) {
        fs.renameSync(path.dirname(f.pathName), f.newDirName);
        fs.renameSync(f.pathName, f.newFileName);
        return f;
      })
      .then(function(f) { l(f); return f; })
  });
}

renameFiles(__dirname);
