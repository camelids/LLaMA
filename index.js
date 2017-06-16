// This file implements LLaMA, a client-side defense against WF,
// as an add-on for the Tor browser. It can be easily installed
// by following the same procedure as with any other FF add-ons.

const { Cc, Ci } = require('chrome')
const observerService = Cc["@mozilla.org/observer-service;1"].
                        getService(Ci.nsIObserverService);
const URL = "https://tablog-webfpext.rhcloud.com/getsize.php";
const Request = require("sdk/request").Request;

// whether to delay requests
const DELAY = true;
// whether to send extra requests
const EXTRA = true;

// Median time to load a site in our dataset.
const MEDIAN_TOTAL = 3600; 

// it will last until the end of the session
// we could flush it from time to time. we can
// keep it as it is for now.
var DOMAINS = {};

// send an HTTP request
var sendRequest = function(target) {
    var req = Request({
        url: target,
        overrideMimeType: "text/plain;",
        onComplete: function(response) {
            // log extra response
            var sz = response.text.length;
            console.log("X-RES: " + target + " (" + sz + "B)");
        }
    });
    var d = new Date();
    var ts = d.getTime();
    // log extra request
    console.log("X-REQ: " + target);
    req.get();
}

// send a custom-sized request
var sendSizeRequest = function(size) {
    sendRequest(URL + '?size=' + size);
}

// send a request depending on the outcome of tossing a coin
var probSendRequest = function(sendRequestCallback, arg, delay) {
    if (typeof delay === "undefined") {
        delay = Math.floor(Math.random() * 1001);
    }
    if (Math.random() > 0.5) {
        // Delay request
        delayedFunction(delay, function() {
            sendRequestCallback(arg);
        });
    }
}

// trigger another request with some prob
var customNewRequest = function() {
    var size = Math.floor(Math.random() * 1000001);
    probSendRequest(sendSizeRequest, size);
}

// repeat a previous request with some prob
var repeatRandomRequest = function(domain) {
    var requests = DOMAINS[domain];
    // select a previous request uniformly at random
    if (!(typeof requests === "undefined") && (requests.length > 0)) {
        var url = requests[Math.floor(Math.random() * requests.length)];
        probSendRequest(sendRequest, url, 0);
    }
}

// delay the execution of a function
var delayedFunction = function(delay, fun) {
    var timer = Cc["@mozilla.org/timer;1"].createInstance(Ci.nsITimer);
    timer.initWithCallback({
        notify: function(timer) {
            fun();
        }
    }, delay, Ci.nsITimer.TYPE_ONE_SHOT);
}

var httpObs = {
    observe: function(aSubject, aTopic, aData) {
        aSubject.QueryInterface(Ci.nsIHttpChannel);
        var visitor = new HeaderInfoVisitor(aSubject);
        if (aTopic == "http-on-modify-request") {

            // suspend request and schecule resume after a number
            // between 0 and 1 seconds.
            if (aSubject instanceof Ci.nsIRequest) { // Is this needed?

                // add url for this domain
                if (aSubject.URI instanceof Ci.nsIURI) {
                    var requestHeaders = visitor.visitRequest();
                    var domain = aSubject.URI.host;
                    var url = aSubject.URI.spec;
                    var sheaders = get_str(requestHeaders);
                    console.log("REQ: " + url + ", headers=" + sheaders);

                    // add domain to known domains
                    if (!(domain in DOMAINS)) {
                        DOMAINS[domain] = [];
                    }
                    if (DOMAINS[domain].indexOf(url) == -1) {
                        DOMAINS[domain].push(url);
                    }

                    // delay request
                    if (DELAY) {
                        aSubject.suspend();
                        // sample a delay
                        d = Math.floor(Math.random() * MEDIAN_TOTAL);
                        delayedFunction(d, function() {
                            aSubject.resume();
                            console.log("RESUMED: " + url);
                        });
                        console.log("DELAY: " + url + "("+ d +" ms)");
                    }
                    if (EXTRA) {
                        // fire another request after this one?
                        repeatRandomRequest(domain);
                    }
                }
            }
        } else if (aTopic == "http-on-examine-response") {
            var url = aSubject.URI.asciiSpec;
            var responseHeaders = visitor.visitResponse();
            var sheaders = get_str(responseHeaders);
            console.log("RESP: " + url + ", headers=" + sheaders);
        }
    },
};

function HeaderInfoVisitor(oHttp) {
    this.oHttp = oHttp;
    this.headers = new Array();
}

HeaderInfoVisitor.prototype = {
    visitHeader: function(name, value) {
        this.headers[name] = value;
    },
    visitRequest: function() {
        this.oHttp.visitRequestHeaders(this);
        return this.headers;
    },
    visitResponse: function() {
        this.oHttp.visitResponseHeaders(this);
        return this.headers;
    }
};

// register HTTP observers
observerService.addObserver(httpObs, "http-on-modify-request", false);
observerService.addObserver(httpObs, "http-on-examine-response", false);
