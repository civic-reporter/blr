/* leaflet-control-geocoder - v2.4.0 */
/* Full version */

(function (factory, window) {
    if (typeof define === "function" && define.amd) {
        // AMD
        define(["leaflet"], factory);
    } else if (typeof exports === "object") {
        // Node/CommonJS
        module.exports = factory(require("leaflet"));
    } else {
        // Browser globals
        factory(window.L);
    }
}(function (L) {
    L.Control.Geocoder = {
        jsonp: function (url, params, callback, context, jsonpParam) {
            var callbackId = '_l_geocoder_' + (L.Control.Geocoder.callbackId++);

            params = params || {};
            params[jsonpParam || 'callback'] = callbackId;

            var script = document.createElement('script');
            script.type = 'text/javascript';
            script.src = url + L.Util.getParamString(params);

            window[callbackId] = L.Util.bind(function (data) {
                callback.call(context, data);
                delete window[callbackId];
                document.body.removeChild(script);
            }, this);

            document.body.appendChild(script);
        },

        getJSON: function (url, params, callback) {
            var xhr = new XMLHttpRequest();

            xhr.onreadystatechange = function () {
                if (xhr.readyState !== 4) return;

                var status = xhr.status;
                if ((status >= 200 && status < 300) || status === 304) {
                    var data = JSON.parse(xhr.responseText);
                    callback(data);
                }
            };

            xhr.open('GET', url + L.Util.getParamString(params), true);
            xhr.send(null);
        }
    };

    L.Control.Geocoder.callbackId = 0;

    L.Control.geocoder = function (options) {
        return new L.Control.Geocoder.Nominatim(options);
    };

    L.Control.Geocoder.Nominatim = L.Class.extend({
        options: {
            serviceUrl: "https://nominatim.openstreetmap.org/search",
            geocodingQueryParams: {},
        },

        initialize: function (options) {
            L.Util.setOptions(this, options);
        },

        geocode: function (query, cb) {
            var params = {
                q: query,
                format: "json",
                addressdetails: 1
            };
            L.Control.Geocoder.getJSON(this.options.serviceUrl, params, function (data) {
                var results = [];
                for (var i = 0; i < data.length; i++) {
                    var d = data[i];
                    var bbox = d.boundingbox;
                    results.push({
                        name: d.display_name,
                        bbox: L.latLngBounds([[bbox[0], bbox[2]], [bbox[1], bbox[3]]]),
                        center: L.latLng(d.lat, d.lon)
                    });
                }
                cb(results);
            });
        },
    });

    L.Control.Geocoder.Control = L.Control.extend({
        options: {
            position: 'topleft',
            placeholder: "Search…",
            collapsed: true,
        },

        initialize: function (options) {
            L.setOptions(this, options);
            this._geocoder = L.Control.geocoder(options);
        },

        onAdd: function (map) {
            var container = L.DomUtil.create('div', 'leaflet-control-geocoder');
            var input = L.DomUtil.create('input', 'leaflet-control-geocoder-input', container);
            input.type = 'text';
            input.placeholder = this.options.placeholder;

            L.DomEvent.disableClickPropagation(container);
            L.DomEvent.on(input, 'keyup', this._handleKeypress, this);

            this._map = map;
            this._input = input;

            return container;
        },

        _handleKeypress: function (e) {
            var value = this._input.value;
            if (e.keyCode === 13) {
                this._geocoder.geocode(value, function (results) {
                    if (results.length > 0) {
                        var result = results[0];
                        this._map.fitBounds(result.bbox);
                        L.marker(result.center)
                            .addTo(this._map)
                            .bindPopup(result.name)
                            .openPopup();
                    }
                }.bind(this));
            }
        }
    });

    L.Control.geocoder = function (options) {
        return new L.Control.Geocoder.Control(options);
    };

    return L.Control.Geocoder;
}, window));
