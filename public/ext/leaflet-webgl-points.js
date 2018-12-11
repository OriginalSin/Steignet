/*
 * MIT Copyright 2018 OriginalSin <serg@auchat.ru>
 * https://russian-face.ru/
 * Please attribute OriginalSin in any production associated with this JavaScript plugin.
 */

L.WebGLPoints = L.Renderer.extend({

    version: '0.1.0',

    options: {
        // @option size: Number
        // corresponds with units below
        size: 30000,
        // @option units: String
        // 'm' for meters or 'px' for pixels
        units: 'm',
        opacity: 1,
        gradientTexture: false,
        alphaRange: 1,
        // @option padding: 
        // don't add padding (0 helps with zoomanim)
        padding: 0
    },

    _initContainer: function() {
        var container = this._container = L.DomUtil.create('canvas', 'leaflet-zoom-animated'),
            options = this.options;

        container.id = 'webgl-' + L.Util.stamp(this);
        container.style.opacity = options.opacity;
        container.style.position = 'absolute';

// console.log('nnnnnn', options)

        try {
            this._createGL(options.reglModules);
        } catch (e) {
            console.error(e);
        }

        this._container = container;
    },

    onAdd: function() {
        // save this to a shorter method
        this.size = this.options.size;

        L.Renderer.prototype.onAdd.call(this);

        this.resize();
    },

    // onRemove-ish
    _destroyContainer: function () {
        L.DomUtil.remove(this._container);
        L.DomEvent.off(this._container);
        delete this._container;
    },

    // events

    getEvents: function() {
        var events = L.Renderer.prototype.getEvents.call(this);

        L.Util.extend(events, {
            click: this._click,
            resize: this.resize,
            move: L.Util.throttle(this._update, 49, this)
        });

        return events;
    },

    _click: function(ev) {
		console.log(ev);
    },

    _update: function() {
        L.Renderer.prototype._update.call(this);
        this.draw();
    },

    data: [],

    addDataPoint: function(lat, lon, value) {
        // this.data.push([lat, lon, value / 100]);
    },

    setData: function(dataset, opt) {
		if (opt) {
			if (opt.type === 'latlng') {
				var WW = 40075016.685578496 / 2;
				this.position = dataset.map(function (it) {
					var latlng = L.latLng(it[0], it[1]),
						merc = L.CRS.EPSG3857.project(latlng);
					return [merc.x / WW, merc.y / WW];
				});
			} else {
				this.position = dataset;
			}
		} else {
			this.position = dataset;
		}

        this.draw();
    },

    clear: function() {
        this.setData([]);
    },

    // draw function

	_needRedraw: true,
    draw: function() {

        if (!this._map) return;

        this.reposition();
		this._needRedraw = true;
    },

    resize: function() {
        var canvas = this._container,
            size = this._map.getSize();

        canvas.width = size.x;
        canvas.height = size.y;

        this.draw();
    },

    reposition: function() {
        // canvas moves opposite to map pane's position
        var pos = this._map._getMapPanePos().multiplyBy(-1);
        L.DomUtil.setPosition(this._container, pos);
    },

    pixelsToWebGLMatrix: new Float32Array(16),

    _prepareMat: function() {
 		if (this._map) {
			var map = this._map,
				rw = 256 * Math.pow(2, map.getZoom()),
				pbs = map.getPixelBounds(),
				size = pbs.getSize(),
				rx = rw / size.x,
				ry = rw / size.y,
				tx =  1 - 2 * pbs.max.x / size.x  + rx,
				ty =  2 * pbs.min.y / size.y - ry + 1;

			this.pixelsToWebGLMatrix.set([
				rx,	0,	0, 0,
				0,	ry,	0, 0,
				0,	0,	0, 0,
				tx,	ty,	0, 1
			]);
		} else {
			this.pixelsToWebGLMatrix.set([
				1, 	0, 0, 0,	//	rx	0	0	0	[0.9999999999999998, 0.28054992616958996]
				0,	1, 0, 0,	//	0	ry	0	0
				0, 0, 0, 0,		//	0	0	0	0	
				0, 0, 0, 1		//	tx	ty	0	0
			]);
		}
		return this.pixelsToWebGLMatrix;
   },

    _createGL: function(reglModules) {
		var regl = reglModules.regl({
			// profile: true,
			canvas: this._container
		});

		this.drawPoints = regl({
		  frag: `
		  precision mediump float;
		  uniform vec4 color;
		  void main () {
			gl_FragColor = color;
		  }`,

		  vert: `
			uniform mat4 u_matrix;
			precision mediump float;
			attribute vec2 position;
			void main () {
				gl_PointSize = 8.0;
				// gl_Position = vec4(position.x * u_matrix[0][0] + u_matrix[3][0], position.y * u_matrix[1][1] + u_matrix[3][1] , 0, 1);
				gl_Position = u_matrix * vec4(position, 0, 1);
			}`,

		  attributes: {
			position: this.position
		  },

		  uniforms: {
			u_matrix: regl.prop('matrix'),
			color: [0, 0, 1, 1]
		  },

		  primitive: 'points',
		  count: this.position.length
		});

		var tick = regl.frame(() => {
			if (this._needRedraw) {
				regl.clear({
					depth: 1
				});
				this.drawPoints({
					depth: 1,
					matrix: this._prepareMat()
				});
				this._needRedraw = false;
				// tick.cancel();
				}
		});
		return regl;
	}

});

L.webGLPoints = function(options) {
    return new L.WebGLPoints(options);
};
