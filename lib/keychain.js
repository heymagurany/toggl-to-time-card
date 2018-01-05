var childProcess = require('child_process');
var command = 'security';

exports.getGenericPassword = function(service, callback) {
  var args = [
    'find-generic-password',
    '-s',
    service,
    '-g'
  ];
  var security = childProcess.spawn(command, args);
  var output = '';
  var error = '';

  security.stdout.on('data', function (data) {
    output += data.toString();
  });

  security.stderr.on('data', function (data) {
    error += data.toString();
  });

  security.on('error', function (err) {
    callback(err);
  });

  security.on('exit', function (code) {
    var accountPattern = /"acct"\s*[^=]*\s*=\s*"([^"]+)"/i;
    var passwordPattern = /password\s*:\s*"([^"]+)"/im;

    if (code === 0) {
      var accountMatches = accountPattern.exec(output);
      var passwordMatches = passwordPattern.exec(error);

      if (accountMatches && (accountMatches.length > 0) && passwordMatches && (passwordMatches.length > 0)) {
        callback(null, true, accountMatches[1], passwordMatches[1]);

        return;
      }
    }

    callback(null, false);
  });
};

exports.setGenericPassword = function(service, account, password, callback) {
  var args = [
    'add-generic-password',
    '-s',
    service,
    '-a',
    account,
    '-w',
    password
  ];
  var security = childProcess.spawn(command, args);
  var error = '';

  security.stderr.on('data', function (data) {
    error += data.toString();
  });

  security.on('error', function (err) {
    callback(err);
  });

  security.on('exit', function (code) {
    if (code !== 0) {
      callback(error);
      return;
    }

    callback(null);
  });
};
