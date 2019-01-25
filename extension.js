const St = imports.gi.St;
const GLib = imports.gi.GLib;
const Main = imports.ui.main;
const Soup = imports.gi.Soup;
const Lang = imports.lang;
const Mainloop = imports.mainloop;
const Clutter = imports.gi.Clutter;
const PanelMenu = imports.ui.panelMenu;

const API_URL = 'https://api.nordvpn.com/server';
const IP_URL = 'http://ifconfig.me/ip';

let _httpSession;


function log(msg) {
  global.log('[NordVPN] ' + msg);
}

const NordVPN = new Lang.Class({
  Name: 'NordVPN',
  Extends: PanelMenu.Button,
  serverLookUpTable: undefined,

  _init: function() {
    this.parent(0.0, 'NordVPN Widget', false);
    this.buttonText = new St.Label({
      text: _('Checking...'),
      y_align: Clutter.ActorAlign.CENTER
    });
    this.actor.add_actor(this.buttonText);
    this._refresh();
  },

  _refresh: function() {
    log('Refreshing');
    this._checkIP();
    this._removeTimeout();
    this._timeout = Mainloop.timeout_add_seconds(60, Lang.bind(this, this._refresh));
    return true;
  },

  _checkIP: function() {
      let IP = this._fetchRouteIP();
      if(IP) {
        log('Route IP: ' + IP);
        if (typeof this.serverLookUpTable == 'undefined') {
          this._loadServerList(IP);
        } else {
          this._refreshUI(IP);
        }
      } else {
        this._checkPublicIP();
      }
   },
  _fetchRouteIP: function() {
    // route | grep 255.255.255.255
    // expected output
    // 46-227-67-107.s _gateway        255.255.255.255 UGH   0      0        0 eno1
    // fetch the ip from there
    // this function depends on sh, route and grep
    let out = GLib.spawn_command_line_sync("sh -c \"route | grep 255.255.255.255\"")
    if(out) {
        // 
	let r = /((25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\-){3}(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)/;
        let result =  r.exec(out);
        if(result) {
	    return result[0].replace(/\-/g, ".");
        }
     }
     return null;
   },
  _checkPublicIP: function() {
    let IP;
    _httpSession = new Soup.Session();
    let message = Soup.form_request_new_from_hash('GET', IP_URL, {});
    message.request_headers.append('User-Agent', 'curl/7.55.1');  // Fake CURL to prevent 403
    message.request_headers.append('Accept', '*/*');  // Fake CURL to prevent 403
    _httpSession.queue_message(message, Lang.bind(this, function(_httpSession, message) {
      if (message.status_code !== 200) {
        log('IP request failed with code ' + String(message.status_code));
        IP = 'Failed to retrieve';
      } else {
        IP = message.response_body.data.trim();
      }
      log('Pubic IP: ' + IP);
      if (typeof this.serverLookUpTable == 'undefined') {
        this._loadServerList(IP);
      } else {
        this._refreshUI(IP);
      }
    }));
  },

  _loadServerList: function(IP) {
    _httpSession = new Soup.Session();
    let message = Soup.form_request_new_from_hash('GET', API_URL, {});
    _httpSession.queue_message(message, Lang.bind(this, function(_httpSession, message) {
      if (message.status_code !== 200) {
        log('API request failed with code ' + String(message.status_code));
        // Since the retrival of the lookUp table is done only once, an early
        // exit here will mean that the widget will reamain on 'Checking...'
        // until the following loop (=no risk of displaying a wrong status).
        return;
      }
      this.serverLookUpTable = {};
      let json = JSON.parse(message.response_body.data);
      for (var property in json) {
        if (json.hasOwnProperty(property)) {
          let data = json[property];
          this.serverLookUpTable[data.ip_address] = data.name;
        }
      }
//      this.serverLookUpTable["185.246.130.71"] = "NordVPN#192";
//      this.serverLookUpTable["46.227.67.108"] = "NordVPN#131";
 
      this._refreshUI(IP);
    }));
  },

  _refreshUI: function(IP) {
    let server = this.serverLookUpTable[IP];
    if (server) {
      server = ' ' + server + ' ';
      this.buttonText.style_class = 'protected';
    } else {
      server = ' UNPROTECTED ';
      this.buttonText.style_class = 'unprotected';
    }
    this.buttonText.set_text(server);
  },

  _removeTimeout: function() {
    if (this._timeout) {
      Mainloop.source_remove(this._timeout);
      this._timeout = null;
    }
  },

  stop: function() {
    if (_httpSession !== undefined)
      _httpSession.abort();
    _httpSession = undefined;

    if (this._timeout)
      Mainloop.source_remove(this._timeout);
    this._timeout = undefined;

    this.menu.removeAll();
  }
});

let widget;

function init() {}

function enable() {
  widget = new NordVPN;
  Main.panel.addToStatusArea('NordVPN-widget', widget);
}

function disable() {
  widget.stop();
  widget.destroy();
}
