const assert      = require('assert');
const Browser     = require('../src/zombie');
const { brains }  = require('./helpers');


describe("XMLHttpRequest", function() {
  let browser;

  before(function*() {
    browser = Browser.create();
    yield brains.ready();
  });


  describe("asynchronous", function() {
    before(function*() {
      brains.get('/xhr/async', function(req, res) {
        res.send("\
          <html>\
            <head><script src='/jquery.js'></script></head>\
            <body>\
              <script>\
                document.title = 'One';\
                window.foo = 'bar';\
                $.get('/xhr/async/backend', function(response) {\
                  window.foo += window.foo;\
                  document.title += response;\
                });\
                document.title += 'Two';\
              </script>\
            </body>\
          </html>\
          ");
      });
      brains.get('/xhr/async/backend', function(req, res) {
        res.send("Three");
      });
      yield browser.visit('/xhr/async');
    });

    it("should load resource asynchronously", function() {
      browser.assert.text('title', "OneTwoThree");
    });
    it("should run callback in global context", function() {
      browser.assert.global('foo', "barbar");
    });
  });


  describe("response headers", function() {
    before(function*() {
      brains.get('/xhr/headers', function(req, res) {
        res.send("\
          <html>\
            <head><script src='/jquery.js'></script></head>\
            <body>\
              <script>\
                $.get('/xhr/headers/backend', function(data, textStatus, jqXHR) {\
                  document.allHeaders = jqXHR.getAllResponseHeaders();\
                  document.headerOne = jqXHR.getResponseHeader('Header-One');\
                  document.headerThree = jqXHR.getResponseHeader('header-three');\
                });\
              </script>\
            </body>\
          </html>\
          ");
      });
      brains.get('/xhr/headers/backend', function(req, res) {
        res.setHeader('Header-One', 'value1');
        res.setHeader('Header-Two', 'value2');
        res.setHeader('Header-Three', 'value3');
        res.send('');
      });
      yield browser.visit('/xhr/headers');
    });

    it("should return all headers as string", function() {
      assert(~browser.document.allHeaders.indexOf('header-one: value1\nheader-two: value2\nheader-three: value3'));
    });
    it("should return individual headers", function() {
      assert.equal(browser.document.headerOne,   'value1');
      assert.equal(browser.document.headerThree, 'value3');
    });
  });


  describe("cookies", function() {
    before(function*() {
      brains.get('/xhr/cookies', function(req, res) {
        res.cookie('xhr', 'send', { path: '/xhr' });
        res.send("\
          <html>\
            <head><script src='/jquery.js'></script></head>\
            <body>\
              <script>\
                $.get('/xhr/cookies/backend', function(cookie) {\
                  document.received = cookie;\
                });\
              </script>\
            </body>\
          </html>\
          ");
      });
      brains.get('/xhr/cookies/backend', function(req, res) {
        let cookie = req.cookies.xhr;
        res.cookie('xhr', 'return', { path: '/xhr' });
        res.send(cookie);
      });
      yield browser.visit('/xhr/cookies');
    });

    it("should send cookies to XHR request", function() {
      assert.equal(browser.document.received, 'send');
    });
    it("should return cookies from XHR request", function() {
      assert(/xhr=return/.test(browser.document.cookie));
    });
  });


  describe("redirect", function() {
    before(function*() {
      brains.get('/xhr/redirect', function(req, res) {
        res.send("\
          <html>\
            <head><script src='/jquery.js'></script></head>\
            <body>\
              <script>\
                $.get('/xhr/redirect/backend', function(response) { window.response = response });\
              </script>\
            </body>\
          </html>\
          ");
      });
      brains.get('/xhr/redirect/backend', function(req, res) {
        res.redirect('/xhr/redirect/target');
      });
      brains.get('/xhr/redirect/target', function(req, res) {
        res.send("redirected " + req.headers['x-requested-with']);
      });
      yield browser.visit('/xhr/redirect');
    });

    it("should follow redirect", function() {
      assert(/redirected/.test(browser.window.response));
    });
    it("should resend headers", function() {
      assert(/XMLHttpRequest/.test(browser.window.response));
    });
  });


  describe("handle POST requests with no data", function() {
    before(function*() {
      brains.get('/xhr/post/empty', function(req, res) {
        res.send("\
          <html>\
            <head><script src='/jquery.js'></script></head>\
            <body>\
              <script>\
                $.post('/xhr/post/empty', function(response, status, xhr) { document.title = xhr.status + response });\
              </script>\
            </body>\
          </html>\
          ");
      });
      brains.post('/xhr/post/empty', function(req, res) {
        res.send("posted", 201);
      });
      yield browser.visit('/xhr/post/empty');
    });

    it("should post with no data", function() {
      browser.assert.text('title', "201posted");
    });
  });


  describe("empty response", function() {
    before(function*() {
      brains.get('/xhr/get-empty', function(req, res) {
        res.send("\
          <html>\
            <head><script src='/jquery.js'></script></head>\
            <body>\
              <script>\
                $.get('/xhr/empty', function(response, status, xhr) {\
                  document.text = xhr.responseText;\
                });\
              </script>\
            </body>\
          </html>\
          ");
      });
      brains.get('/xhr/empty', function(req, res) {
        res.send("");
      });
      yield browser.visit('/xhr/get-empty');
    });

    it("responseText should be an empty string", function() {
      assert.strictEqual("", browser.document.text);
    });
  });


  describe("response text", function() {
    before(function*() {
      brains.get('/xhr/get-utf8-octet-stream', function(req, res) {
        res.send("\
          <html>\
            <head><script src='/jquery.js'></script></head>\
            <body>\
              <script>\
                $.get('/xhr/utf8-octet-stream', function(response, status, xhr) {\
                  document.text = xhr.responseText;\
                });\
              </script>\
            </body>\
          </html>\
          ");
      });
      brains.get('/xhr/utf8-octet-stream', function(req, res) {
        res.type('application/octet-stream');
        res.send("Text");
      });
      yield browser.visit('/xhr/get-utf8-octet-stream');
    });

    it("responseText should be a string", function() {
      assert.equal(typeof(browser.document.text), 'string');
      assert.equal(browser.document.text, "Text");
    });
  });


  describe("xhr onreadystatechange", function() {
    before(function*() {
      brains.get('/xhr/get-onreadystatechange', function(req, res) {
        res.send("\
          <html>\
            <head></head>\
            <body>\
              <script>\
                document.readyStatesReceived = { 1:[], 2:[], 3:[], 4:[] };\
                var xhr = new XMLHttpRequest();\
                xhr.onreadystatechange = function(){\
                  document.readyStatesReceived[xhr.readyState].push(Date.now())\
                };\
                xhr.open('GET', '/xhr/onreadystatechange', true);\
                xhr.send();\
              </script>\
            </body>\
          </html>\
          ");
      });
      brains.get('/xhr/onreadystatechange', function(req, res) {
        res.send("foo");
      });
      yield browser.visit('/xhr/get-onreadystatechange');
    });

    it("should get exactly one readyState of type 1, 2, and 4", function() {
      assert.equal(browser.document.readyStatesReceived[1].length, 1);
      assert.equal(browser.document.readyStatesReceived[2].length, 1);
      assert.equal(browser.document.readyStatesReceived[4].length, 1);
    });

    it("should get the readyStateChanges in chronological order", function() {
      assert(browser.document.readyStatesReceived[1][0] <=
             browser.document.readyStatesReceived[2][0]);
      assert(browser.document.readyStatesReceived[2][0] <=
             browser.document.readyStatesReceived[4][0]);
    });

  });


  describe.skip("HTML document", function() {
    before(function*() {
      brains.get('/xhr/get-html', function(req, res) {
        res.send("\
          <html>\
            <head><script src='/jquery.js'></script></head>\
            <body>\
              <script>\
                $.get('/xhr/html', function(response, status, xhr) {\
                  document.body.appendChild(xhr.responseXML);\
                });\
              </script>\
            </body>\
          </html>\
          ");
      });
      brains.get('/xhr/html', function(req, res) {
        res.type('text/html');
        res.send("<foo><bar id='bar'></foo>");
      });
      yield browser.visit('/xhr/get-html');
    });

    it("should parse HTML document", function() {
      browser.assert.element('foo > bar#bar');
    });
  });


  after(function() {
    browser.destroy();
  });
});
