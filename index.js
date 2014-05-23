var os = require('os');
var path = require('path');
var fs = require('fs');
var _ = require('underscore');

var HTMLReporter = function (baseReporterDecorator, config, emitter, logger, helper, formatError) {

    var defaultTemplatePath = path.resolve(__dirname, 'template.html'),
        outputPath = config.htmlReporter.outputPath,
        template = config.htmlReporter.template ? fs.readFileSync(config.htmlReporter.template, 'utf8') : fs.readFileSync(defaultTemplatePath, 'utf8');
        reports = {},
        log = logger.create('karam-gvreporter'),
        pendingCount = 0;

    baseReporterDecorator(this);

    var basePathResolve = function (relativePath) {
        if (helper.isUrlAbsolute(relativePath)) {
            return relativePath;
        }
        if (!helper.isDefined(config.basePath) || !helper.isDefined(relativePath)) {
            return '';
        }
        return path.resolve(config.basePath, relativePath);
    };

    this.onRunStart = function (browsers) {
        browsers.forEach(function (browser) {
            reports[browser.id] = {
                id: browser.id,
                browser: browser.name,
                userAgent: browser.fullName,
                runtime: 0,
                timestamp: new Date(),
                total: 0,
                passed: 0,
                failed: 0,
                results: [],
                hasFailure: false
            };
        });
    };

    this.onBrowserComplete = function (browser) {
        var result = browser.lastResult;
        var report = reports[browser.id];

        report.total = result.total;
        report.passed = result.total - result.failed;
        report.failed = result.failed;
        report.runtime = result.netTime || 0;
        if (report.failed) {
            report.hasFailure = true;
        }
    };

    this.specSuccess = this.specSkipped = this.specFailure = function (browser, result) {
        reports[browser.id].results.push(result);
    };

    this.onRunComplete = function (browsers, results) {
        for (var id in reports) {
            if (reports.hasOwnProperty(id)) {
                ++pendingCount;
                var report = reports[id],
                    html = '';
                try {
                    html = _.template(template, report);
                } catch (err) {
                    log.error(err.message);
                }
                var output = outputPath.replace(':browser', report.browser.split(' ')[0])
                    .replace(':id', report.id)
                    .replace(':timestamp', report.timestamp.getTime());

                fs.writeFile(basePathResolve(output), html, function (err) {
                    if (err) {
                        log.error(err.message);
                    } else {
                        if (!--pendingCount) {
                            log.info('Reports written to "%s".', basePathResolve(outputPath));
                        }
                    }
                });
            }
        }

    };
};

HTMLReporter.$inject = ['baseReporterDecorator', 'config', 'emitter', 'logger', 'helper', 'formatError'];

// PUBLISH DI MODULE
module.exports = {
    'reporter:html': ['type', HTMLReporter]
};
