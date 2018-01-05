var timeCard = require('../lib/timecard.js');
var toggl = require('../lib/toggl.js');
var readline = require('readline');
var async = require('async');

var createClients = function(client, ditClients, togglClientsLookup, callback) {
  var mappedClients = [];

  async.each(ditClients, function (ditClient, callback) {
    if (ditClient.name) {
      var togglClientID = togglClientsLookup[ditClient.name];

      if (togglClientID) {
        mappedClients.push({
          togglClientID: togglClientID,
          ditProjects: ditClient.projects
        });

        console.log('toggl client, "' + ditClient.name + '," already exists.');

        callback(null);
      }
      else {
        var togglClient = {
          name: ditClient.name,
          wid: togglWorkspaceID
        };

        client.createClient(togglClient, function (err, togglClient) {
          if (err) {
            callback(err);
            return;
          }

          mappedClients.push({
            togglClientID: togglClient.id,
            ditProjects: ditClient.projects
          });

          console.log('Created toggl client, "' + togglClient.name + '."');

          callback(null);
        });
      }
    }
    else {
      mappedClients.push({
        togglClientID: null,
        ditProjects: ditClient.projects
      });
      callback(null);
    }
  },
  function (err) {
    if (err) {
      callback(err);
      return;
    }

    callback(null, mappedClients);
  });
};

var createProjects = function(client, ditProjects, togglClientID, togglProjectsLookup, callback) {
  var mappedProjects = [];

  async.each(ditProjects, function (ditProject, callback) {
    var togglProject = togglProjectsLookup[ditProject.name];
    var togglTasksLookup = togglProject.tasksLookup;

    if (togglProject) {
      mappedProjects.push({
        togglProjectID: togglProject.id,
        togglTasksLookup: togglTasksLookup,
        ditTasks: ditProject.tasks
      });

      console.log('toggl project, "' + ditProject.name + '," already exists.');

      // callback for each project
      callback(null);
    }
    else {
      togglProject = {
        name: ditProject.name,
        cid: togglClientID
      };

      client.createProject(togglProject, function (err, togglProject) {
        if (err) {
          // callback for each project
          callback(err);
          return;
        }

        mappedProjects.push({
          togglProjectID: togglProject.id,
          togglTasksLookup: togglTasksLookup,
          ditTasks: ditProject.tasks
        });

        console.log('Created toggl project, "' + togglProject.name + '."');

        // callback for each project
        callback(null);
      });
    }
  },
  function (err) {
    if (err) {
      // callback for waterfall task
      callback(err);
      return;
    }

    // callback for waterfall task
    callback(null, mappedProjects);
  });
};

var createTasks = function(client, ditTasks, togglProjectID, togglTasksLookup, callback) {
  async.each(ditTasks, function(ditTask, callback) {
    var togglTaskID = togglTasksLookup[ditTask];

    if (togglTaskID) {
      console.log('toggl task, "' + ditTask + '," already exists.');

      callback(null);
    }
    else {
      client.createTask(ditTask, togglProjectID, {}, function (err, togglTask) {
        if (err) {
          callback(err);
          return;
        }

        console.log('Created toggl task, "' + togglTask.name + '."');

        callback(null);
      });
    }
  },
  function (err) {
    callback(err);
  });
};

var createTags = function(client, ditActivities, togglTagsLookup, callback) {
  async.each(ditActivities, function (ditActivity, callback) {
    if (togglTagsLookup[ditActivity]) {
      console.log('toggl tag, "' + ditActivity + '," already exists');

      callback(null);
    }
    else {
      client.createTag(ditActivity, togglWorkspaceID, function (err, togglTag) {
        if (err) {
          callback(err);
          return;
        }

        console.log('Created toggl tag, "' + togglTag.name + '."');

        callback(null);
      });
    }
  },
  function (err) {
    callback(err);
  });
};

exports.timeCardToToggl = function () {
  toggl.createClient(function (err, client) {
    if (err) {
      console.log(err);
      return;
    }

    async.waterfall([
      //toggl.getWorkspaceID
      function (callback) {
        var question = 'To which workspace to you want to import?';

        toggl.getWorkspaceID(client, question, function(err, togglWorkspaceID) {
          if (err) {
            callback(err);
            return;
          }

          var togglWorkspace = {
            id: togglWorkspaceID,
            clientsLookup: {},
            projectsLookup: {},
            tagsLookup: {}
          };

          callback(null, togglWorkspace);
        });
      },
      //client.getWorkspaceClients
      function (togglWorkspace, callback) {
        client.getWorkspaceClients(togglWorkspace.id, function (err, togglClients) {
          if (err) {
            callback(err);
            return;
          }

          if (togglClients) {
            togglClients.forEach(function(togglClient) {
              togglWorkspace.clientsLookup[togglClient.name] = togglClient.id;
            });
          }

          callback(null, togglWorkspace);
        });
      },
      //client.getWorkspaceProjects
      function (togglWorkspace, callback) {
        var options = {
          active: 'both'
        };

        client.getWorkspaceProjects(togglWorkspace.id, options, function (err, togglProjects) {
          if (err) {
            callback(err);
            return;
          }

          if (togglProjects) {
            togglProjects.forEach(function (togglProject) {
              togglWorkspace.projectsLookup[togglProject.name] = {
                id: togglProject.id,
                tasksLookup: {}
              };
            });
          }

          callback(null, togglWorkspace);
        });
      },
      //client.getWorkspaceTasks
      function (togglWorkspace, callback) {
        var options = {
          active: 'both'
        };

        client.getWorkspaceTasks(togglWorkspace.id, options, function (err, togglTasks) {
          if (err) {
            callback(err);
            return;
          }

          if (togglTasks) {
            togglTasks.forEach(function (togglTask) {
              var togglProject = togglWorkspace.projectsLookup[togglTask.pid];

              togglProject.tasksLookup[togglTask.name] = togglTask.id;
            });
          }

          callback(null, togglWorkspace);
        });
      },
      //client.getWorkspaceTags
      function (togglWorkspace, callback) {
        client.getWorkspaceTags(togglWorkspaceID, function (err, togglTags) {
          if (err) {
            callback(err);
            return;
          }

          var togglTagsLookup = {};

          if (togglTags) {
            togglTags.forEach(function (togglTag) {
              togglWorkspace.tagsLookup[togglTag.name] = togglTag.id;
            });
          }

          callback(null, togglTagsLookup);
        });
      },
      //timeCard.getTimeCardData
      function (togglWorkspace, callback) {
        timeCard.getTimeCardData(function(err, timeCardData) {
          callback(err, togglWorkspace, timeCardData);
        });
      }
    ],
    function (err, togglWorkspace, timeCardData) {
      if (err) {
        console.log(err);
        return;
      }

      var ditClients = timeCardData.clients;
      var togglClientsLookup = togglWorkspace.clientsLookup;

      // BROKEN!
      createClients(client, ditClients, togglClientsLookup, function (err, mappedClients) {
        if (err) {
          console.log(err);
          return;
        }

        var ditProjects = mappedClient.ditProjects;
        var togglClientID = mappedClient.togglClientID;
        var togglProjectsLookup = togglWorkspace.projectsLookup;

        async.each(mappedClients, function (mappedClient, callback) {
          createProjects(client, ditProjects, togglClientID, togglProjectsLookup, function (err, mappedProjects) {
            if (err) {
              callback(err);
              return;
            }

            async.each(mappedProjects, function (mappedProject, callback) {
              var ditTasks = mappedProject.ditTasks;
              var togglProjectID = mappedProject.togglProjectID;
              var togglTasksLookup = mappedProject.togglTasksLookup;

              createTasks(client, ditTasks, togglProjectID, togglTasksLookup, function (err) {
                callback(err);
              });
            },
            function (err) {
              callback(err);
            });
          });
        },
        function (err) {
          if (err) {
            console.log(err);
          }
        });
      });

      // BROKEN!
      createTags(client, timeCardData.activities, togglWorkspaceID, function (err) {
        if (err) {
          console.log(err);
        }
      });
    });
  });
};
