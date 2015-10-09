/**
 * Created by igor on 07.10.15.
 */
'use strict';

var request = require('request');
var fs = require('fs');
var Bb = require('bluebird');

module.exports = function (url, fileFormDataName) {
    var defaultUrl = url;
    var defaultFFDName = fileFormDataName;
    var reqParams = function (data) {
        var reqParam = {
            url: data.url || defaultUrl,
            formData: {}
        };
        var ffdn = data.fileFormDataName || defaultFFDName;
        reqParam.formData[ffdn] = fs.createReadStream(data.filePath);
        reqParam.formData.fileFormDataName = ffdn;
        return reqParam;
    };

    return {
        postPromise: function (data) {
            return Bb.fromNode(function (callback) {
                request.post(reqParams(data), callback);
            });
        },
        putPromise: function (data) {
            return Bb.fromNode(function (callback) {
                request.put(reqParams(data), callback);
            });
        },
        delPromise: function (data) {
            return Bb.fromNode(function (callback) {
                request.del(data && data.url || defaultUrl, callback);
            });
        },
        getPromise: function (data) {
            return Bb.fromNode(function (callback) {
                request.get(data && data.url || defaultUrl, callback);
            });
        }
    };
};