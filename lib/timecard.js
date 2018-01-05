var async = require('async');
var soap = require('soap');
var request = require('request');
var readline = require('readline');
var keychain = require('./keychain.js');
var _soapUrl = 'https://delmarsd.com/dittimecard/dittimecardws.asmx?wsdl';
var _apiUrl = 'https://delmarsd.com/TimeCardAPI';

var _getCredentials = function (callback) {
  var service = 'urn:toggl-to-timecard:timecard';

  keychain.getGenericPassword(service, function (err, found, username, password) {
    if (err) {
      callback(err);
      return;
    }

    if (found) {
      callback(null, username, password);
      return;
    }

    var rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    async.series({
      username: function (callback) {
        rl.question('username: ', function(username) {
          callback(null, username);
        });
      },
      password: function (callback) {
        rl.question('password: ', function(password) {
          callback(null, password);
        });
      },
      save: function (callback) {
        rl.question('save password to keychain? (y/n) ', function (answer) {
          callback(null, 'y' === answer);
        });
      }
    },
    function (err, credentials) {
      rl.close();

      if (err) {
        callback(err);
        return;
      }

      if (credentials.save) {
        keychain.setGenericPassword(service, credentials.username, credentials.password, function (err) {
          if (err) {
            callback(err);
            return;
          }

          callback(null, credentials.username, credentials.password);
        });
      }
      else {
        callback(null, credentials.username, credentials.password);
      }
    });
  });
};

var _getToken = function (username, password, callback) {
  var tokenRequest = {
    uri: _apiUrl + '/Token',
    form: {
      grant_type: 'password',
      username: username,
      password: password
    }
  };

  request.post(tokenRequest, function (err, response, body) {
    if (err) {
      callback(err);
      return;
    }

    var token = JSON.parse(body);

    callback(null, token);
  });
};

exports.authenticate = function (callback) {
  _getCredentials(function (err, username, password) {
    if (err) {
      callback(err);
      return;
    }

    _getToken(username, password, function (err, token) {
      if (err) {
        callback(err);
        return;
      }

      var auth = {
        username: username,
        accessToken: token.access_token
      };

      callback(null, auth);
    });
  });
};

exports.getTimeCardData = function (callback) {
  soap.createClient(_soapUrl, function (err, client) {
    async.series([
      function (callback) {
        var ditClients = [];
        var ditClientsLookup = {};
        var projectsRequest = {
          CurrentUser: {
            UserID: 'mmagurany'
          }
        };

        client.GetAllProjects(projectsRequest, function (err, response) {
          if (err) {
            callback(err);
            return;
          }

          var responseProjects = response.GetAllProjectsForCurrentUserResult.clsProject;

          async.eachSeries(responseProjects, function (item, callback) {
            var clientName = item.ClientName;
            var clientNameEmpty = 'none';

            if (typeof(clientName) !== 'string') {
              clientName = clientNameEmpty;
            }

            var ditClient = ditClientsLookup[clientName];

            if (!ditClient) {
              ditClient = {
                projects: []
              };

              if (clientName === clientNameEmpty) {
                ditClient.name = null;
              }
              else {
                ditClient.name = clientName;
              }

              ditClientsLookup[clientName] = ditClient;
              ditClients.push(ditClient);
            }

            var projectID = item.ProjectID;
            var project = {
              name: projectID
            };

            ditClient.projects.push(project);

            var tasksRequest = {
              project: {
                ProjectID: projectID
              }
            };

            client.GetAllTasksForProject(tasksRequest, function (err, response) {
              if (err) {
                callback(err);
                return;
              }

              var responseTasks = response.GetAllTasksForProjectResult.clsTask;

              async.map(responseTasks, function (item, callback) {
                callback(null, item.TaskTitle);
              },
              function (err, results) {
                project.tasks = results;

                callback(null);
              });
            });
          },
          function (err) {
            if (err) {
              callback(err);
              return;
            }

            callback(null, ditClients);
          });
        });
      },
      function (callback) {
        client.GetAllActivities(function (err, response) {
          var responseActivities = response.GetAllActivitiesResult.clsActivity;

          async.map(responseActivities, function (item, callback) {
            callback(null, item.ActivityType);
          },
          function (err, results) {
            if (err) {
              callback(err);
              return;
            }

            callback(null, results);
          });
        });
      }
    ],
    function (err, results) {
      if (err) {
        callback(err);
        return;
      }

      callback(null, {
        clients: results[0],
        activities: results [1]
      });
    });
  });
};

exports.addTimeEntry = function (auth, entry, callback) {
  var addEntryRequest = {
    uri: _apiUrl + '/api/entries',
    auth: {
      sendImediately: true,
      bearer: auth.accessToken
    },
    json: {
      username: auth.username,
      project: entry.project,
      task: entry.task,
      minutes: entry.minutes,
      date: entry.date,
      description: entry.description,
      activity: entry.activity,
      billable: entry.billable
    }
  };

  request.post(addEntryRequest, function (err, response, body) {
    callback(err, body);
  });
};
