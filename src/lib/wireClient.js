define(['./couch', './dav', './getputdelete'], function (couch, dav, getputdelete) {
  var prefix = 'remote_storage_wire_',
    stateHandler = function(){},
    errorHandler = function(){};
  function set(key, value) {
    localStorage.setItem(prefix+key, JSON.stringify(value));
  }
  function remove(key) {
    localStorage.removeItem(prefix+key);
  }
  function get(key) {
    var valStr = localStorage.getItem(prefix+key);
    if(typeof(valStr) == 'string') {
      try {
        return JSON.parse(valStr);
      } catch(e) {
        localStorage.removeItem(prefix+key);
      }
    }
    return null;
  }
  function disconnectRemote() {
    remove('storageType');
    remove('storageHref');
    remove('bearerToken');
  }
  function getState() {
    if(get('storageType') && get('storageHref')) {
      if(get('bearerToken')) {
        return 'connected';
      } else {
        return 'authing';
      }
    } else {
      return 'anonymous';
    }
  }
  function on(eventType, cb) {
    if(eventType == 'state') {
      stateHandler = cb;
    } else if(eventType == 'error') {
      errorHandler = cb;
    }
  }

  function getDriver(type, cb) {
    if(type === 'https://www.w3.org/community/rww/wiki/read-write-web-00#couchdb'
      || type === 'https://www.w3.org/community/unhosted/wiki/remotestorage-2011.10#couchdb') {
      cb(couch);
    } else if(type === 'https://www.w3.org/community/rww/wiki/read-write-web-00#webdav'
      || type === 'https://www.w3.org/community/unhosted/wiki/remotestorage-2011.10#webdav') {
      cb(dav);
    } else {
      cb(getputdelete);
    }
  }
  function resolveKey(storageType, storageHref, basePath, relPath) {
    //var nodirs=true;
    var nodirs=false;
    var itemPathParts = ((basePath.length?(basePath + '/'):'') + relPath).split('/');
    var item = itemPathParts.splice(2).join(nodirs ? '_' : '/');
    return storageHref + '/' + itemPathParts[1]
      //+ (storageInfo.properties.legacySuffix ? storageInfo.properties.legacySuffix : '')
      + '/' + (item[2] == '_' ? 'u' : '') + item;
  }
  function setChain(driver, hashMap, mimeType, token, cb, timestamp) {
    var i;
    for(i in hashMap) {
      break;
    }
    if(i) {
      var thisOne = hashMap[i];
      delete hashMap[i];
      driver.set(i, thisOne, mimeType, token, function(err, timestamp) {
        if(err) {
          cb(err);
        } else {
          setChain(driver, hashMap, mimeType, token, cb, timestamp);
        }
      });
    } else {
      cb(null, timestamp);
    }
  }
  return {
    get: function (path, cb) {
      var storageType = get('storageType'),
        storageHref = get('storageHref'),
        token = get('bearerToken');
      if(typeof(path) != 'string') {
        cb('argument "path" should be a string');
      } else {
        getDriver(storageType, function (d) {
          d.get(resolveKey(storageType, storageHref, '', path), token, cb);
        });
      }
    },
    set: function (path, valueStr, mimeType, parentChain, cb) {
      var storageType = get('storageType'),
        storageHref = get('storageHref'),
        token = get('bearerToken');
      if(typeof(path) != 'string') {
        cb('argument "path" should be a string');
      } else if(typeof(valueStr) != 'string') {
        cb('argument "valueStr" should be a string');
      } else {
        getDriver(storageType, function (d) {
          d.set(resolveKey(storageType, storageHref, '', path), valueStr, mimeType, token, function(err, timestamp) {
            if(d.requiresParentChaining && !err) {
              var resolvedParentChain = {};
              for(var i in parentChain) {
                resolvedParentChain[resolveKey(storageType, storageHref, '', i)] = parentChain[i];
              }
              setChain(d, resolvedParentChain, 'application/json', token, cb);
            } else {
              cb(err, timestamp);
            }
          });
        });
      }
    },
    setStorageInfo   : function(type, href) { set('storageType', type); set('storageHref', href); },
    setBearerToken   : function(bearerToken) { set('bearerToken', bearerToken); },
    disconnectRemote : disconnectRemote,
    on               : on,
    getState         : getState
  };
});
