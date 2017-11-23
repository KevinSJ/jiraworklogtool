window.Controller = window.Controller || {};
window.Controller.LogController = (function() {
    function init() {
        return new Promise((resolve, reject) => {
            //initialize jira url
            //TODO: remove hard-coded url
            chrome.storage.sync.get(
                {
                    jiraUrl: "https://jira.coke.com/jira"
                },
                function(items) {
                    JiraHelper.setJiraUrl(items.jiraUrl);
                    resolve();
                }
            );
        });
    }

    function getWorklogsByDay(worklogDate) {
        return new Promise((resolve, reject) => {
            var p = Model.WorklogModel.getUnsavedWorklogFromLocal(worklogDate);
            p.then(items => {
                Model.WorklogModel.clearItems();
                Model.WorklogModel.updateItemsWithLocalData(items);
                JiraHelper.getWorklog(worklogDate)
                    .then(worklogItems => {
                        Model.WorklogModel.updateItemsFromJira(worklogItems);
                        resolve();
                    })
                    .catch(() => {
                        reject();
                    })
                    .then(() => {});
            });
        });
    }

    function getFromText(worklogItemsText) {
        var arr = worklogItemsText.split("\n");
        var result = [];
        for (var i = 0; i < arr.length; i++) {
            var worklogText = arr[i];
            if (worklogText && worklogText.trim()) {
                result.push(JiraParser.parse(worklogText));
            }
        }
        // return [{
        //     timeSpent: "1h",
        //     jira: "CMS-1234",
        //     comment:
        //         "[grooming] align with SM about grooming pending tasks and blocks / align with Devs the grooming tasks and story overview"
        // },
        // {
        //     timeSpent: "2h 30m",
        //     jira: "CMS-1211",
        //     comment:
        //         "working on stuff"
        // }];
        return result;
    }

    function bulkInsert(worklogItemsText) {
        return new Promise((resolve, reject) => {
            var worklogItems = getFromText(worklogItemsText);
            Model.WorklogModel.addAll(worklogItems);
            resolve();
        });
    }

    function save(items, date) {
        return new Promise((resolve, reject) => {
            console.log(items);
            var promises = [];
            var i = items.length;
            while (i--) {
                var item = items[i];
                var promise;
                switch (item.status) {
                    case "saved":
                        console.log("item already saved", item);
                        break;
                    case "invalid":
                        break;
                    case "edited":
                        break;
                    case "new":
                        var promise = JiraHelper.logWork(item, date);
                        promise
                            .then(item => {
                                //remove item from local storage. Marking it as 'saved' will prevent it from being 
                                item.status = 'saved';
                                items.splice(items.indexOf(item),1)
                                console.log(item);
                            })
                            .catch(error => {
                                console.error('controller.save', error);
                            })
                            .then(() => {});
                        promises.push(promise);
                        break;
                    default:
                        console.log("item ignored", item);
                        break;
                }
            }
            
            Promise.all(promises).then(() => {
                persistUnsavedData(date, items).then(() => {
                    resolve();
                });
            });
        });
    }

    function persistUnsavedData(date, items) {
        return Model.WorklogModel.persistUnsavedWorklogToLocal(date, items);
    }

    return {
        getWorklogsByDay: getWorklogsByDay,
        bulkInsert: bulkInsert,
        persistUnsavedData: persistUnsavedData,
        save: save,
        init: init
    };
})();
