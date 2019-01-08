/*
 * MIT Copyright 2018 OriginalSin <serg@auchat.ru>
 * https://russian-face.ru/
 * Please attribute OriginalSin in any production associated with this JavaScript plugin.
 */

L.WebGLPoints = L.Renderer.extend({

    version: '0.1.0',

    options: {
        size: 10,	// размер точек
		opacity: 1,
		color: 0x0000ff
    },

    _initContainer: function() {
        var container = this._container = L.DomUtil.create('canvas', 'leaflet-zoom-animated'),
            options = this.options;

        container.id = 'webgl-' + L.Util.stamp(this);
        // container.style.opacity = options.opacity;
        container.style.position = 'absolute';

        try {
            this.regl = this._createGL(options.reglModules);
			
        } catch (e) {
            console.error(e);
        }
    },

    onAdd: function() {
        // save this to a shorter method
        this.size = this.options.size;
// this._zoomAnimated = false;

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
console.log('events', events)
        L.Util.extend(events, {
            click: this._click,
            resize: this.resize,
            zoomend: this._zoomend,
            // viewreset: L.Util.throttle(this._update, 49, this),
            move: L.Util.throttle(this._update, 49, this)
        });

        return events;
    },

	_zoomend: function (ev) {
this._startAnimate = false;
		this._needRedraw = true;
console.log('_zoomend', ev)
	},
	_onAnimZoom: function (e) {
        var map = this._map,
		    pos = map._latLngBoundsToNewLayerBounds(map.getBounds(), e.zoom, e.center).min,
			wb = map.getPixelWorldBounds().max,
				pixelOrigin = map.getPixelOrigin(),
			centerPoint = map._getCenterLayerPoint(),
				pixelBounds = map.getPixelBounds(),
				size = pixelBounds.getSize(),
ymin = centerPoint.y - size.y / 2,
ymax = centerPoint.y + size.y / 2,
isTop = ymin + pixelOrigin.y < 0;
console.log('_onAnimZoom', ymin + pixelOrigin.y, pos, ymin, pixelOrigin, e);
if (isTop) {
	// return;
// pos.y += ymin;// + pixelOrigin.y;
}
		L.DomUtil.setTransform(this._container,
		    pos,
			map.getZoomScale(e.zoom)
		);
    },

	_onAnimZoom11: function (ev) {
		// this._updateTransform(ev.center, ev.zoom);
this._animateZoom = ev.zoom;
console.log('_onAnimZoom', ev)
	},

    reposition: function() {
			// if (!this._startAnimate) {
        // canvas moves opposite to map pane's position
        var pos = this._map._getMapPanePos().multiplyBy(-1),
			scale = this._map.getZoomScale(this._animateZoom) || 1;
        L.DomUtil.setPosition(this._container, pos);
			// }
console.log('reposition', pos, arguments);
    },

    _click: function(ev) {
		console.log(ev);
    },

    _update: function() {
        L.Renderer.prototype._update.call(this);
// console.log('_update', this.pixelsToWebGLMatrix)
        this.draw();
    },

    data: [],

    addDataPoint: function(lat, lon, value) {
        // this.data.push([lat, lon, value / 100]);
    },

    position: [],
    setData: function(dataset, opt) {
		if (opt) {
			if (opt.type === 'latlng') {
				var WW = 40075016.685578496 / 2;
				// var WW = 40073012.485578496 / 2;
				this.position = dataset.map(function (it) {
							// var latlng = L.latLng(it[1], it[2]),
								// merc = L.CRS.EPSG3857.project(latlng);
							// return [merc.x / WW, merc.y / WW];
					var len = it.length,
						colorIndex = it[3],
						filterIndex = it[4],
						latlng = L.latLng(it[1], it[2]),
						merc = L.CRS.EPSG3857.project(latlng);
					return [merc.x / WW, merc.y / WW, colorIndex, filterIndex];
				});
			} else if (opt.type === 'Float32Array') {
				// var ndarray = this.options.reglModules.ndarray(dataset, [opt.length, dataset.length / opt.length, opt.length]);
				// var ndarray = this.options.reglModules.ndarray(dataset, [dataset.length, 1, opt.length]);
				// this.position = opt.regl.buffer({
				  // dimension: opt.length,
				  // data: ndarray
				// });
				this.position = opt.regl.buffer({
				  dimension: dataset.length,
				  length: opt.length,
				  data: dataset
				});
				// this.position = ndarray;
				// this.position = opt.regl.buffer(ndarray);
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
		this._prepareMat();
		this._needRedraw = true;
// console.log('draw', this.pixelsToWebGLMatrix)
    },

    resize: function() {
        var canvas = this._container,
            size = this._map.getSize();

        canvas.width = size.x;
        canvas.height = size.y;

        this.draw();
    },

    pixelsToWebGLMatrix: new Float32Array(16),

    _prepareMat: function() {
console.log(this._zoomAnimated);
 		if (this._map) {
			var map = this._map,
				rw = 256 * Math.pow(2, this._zoom),
				// rw = 256 * Math.pow(2, map.getZoom()),
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
// console.log('_prepareMat', this.pixelsToWebGLMatrix, map.getZoom())
		return this.pixelsToWebGLMatrix;
	},

    _pointCode: {
		tile: 0,
		triangle: 0.5,
		circle: 1
	},
	regl: null,
    _createGL: function() {
		var regl = this.options.reglModules.regl({
			// profile: true,
			canvas: this._container
		});
		this.setData(this.options.data, {type: 'latlng'});
		// this.setData(this.options.data, {type: 'Float32Array', regl: regl, length: this.options.vectorSize || 4});

        var v = this.options.color,
			color = [(v >> 16) & 255, (v >> 8) & 255, v & 255, this.options.opacity];

		this.drawPoints = regl({
		  frag: `
			#ifdef GL_ES
			precision mediump float;
			#endif

			#define PI 3.14159265359
			#define TWO_PI 6.28318530718

			uniform vec4 color;
			uniform sampler2D palTexture;
			uniform float pointType;
			varying float v_Angle;
			varying float v_PalNum;

			mat2 rotate2d(float _angle){
				return mat2(cos(_angle),-sin(_angle),
							sin(_angle),cos(_angle));
			}

			void main () {
				// if (v_Filter == 0.0) {
					// discard;
				// }
				if (pointType == 1.0) {			// circle
					vec2 cxy = 2.0 * gl_PointCoord - 1.0;
					// cxy.x -= 0.1;
					float r = dot(cxy, cxy);
					if (r > 1.0) {
						discard;
					}
				} else if (pointType == 0.5) {	// triangle
					vec2 st = gl_PointCoord.xy;
					
					st -= vec2(0.5);			// move space from the center to the vec2(0.0)
					st = rotate2d( sin(PI * v_Angle / 180.) * PI / 2.0 ) * st;	// rotate the space
					st += vec2(0.5);			// move it back to the original place

					st.x /= 0.5;
					st.x -= 0.57;
					st.y += 0.1;

					st = st * 2. - 1.;		// Remap the space to -1. to 1.

					int N = 3;				// Number of sides of your shape

											// Angle and radius from the current pixel
					float a = atan(st.x, st.y) + PI;
					float r = TWO_PI / float(N);

											// Shaping function that modulate the distance
					float d = cos(floor(.5 + a / r) * r - a) * length(st);
					if (d >= 0.5) {
						discard;
					}
				}
				vec4 ndviColor = texture2D(palTexture, vec2((v_PalNum + 0.5) / 256.0, 0.5));
				// gl_FragColor = vec4(ndviColor.rgb, 1.0);
				gl_FragColor = ndviColor;
			}`,

		  vert: `
			precision mediump float;
			attribute vec4 position;
			uniform mat4 u_matrix;
			uniform float pointSize;
			varying float v_Angle;
			varying float v_PalNum;
			void main () {
				gl_PointSize = pointSize;
				gl_Position = u_matrix * vec4(position.xy, 0, 1);
				v_PalNum = position[2];
				v_Angle = position[3];
			}`,

		  attributes: {
			position: this.position
		  },

		  uniforms: {
			pointType: this._pointCode[this.options.pointType] || 0,
			pointSize: this.options.size,
			u_matrix: regl.prop('matrix'),
			palTexture: regl.texture({
				width: this.options.colors.length / 4,
				height: 1,
				data: this.options.colors
			}),
			
			color: color
		  },

		  primitive: 'points',
		  count: this.position.length
		});

		var tick = regl.frame(() => {
			if (this._needRedraw && !this._startAnimate) {
 // if (!this._map.animateToZoom || this._map._zoom === this._map.animateToZoom) {
				regl.clear({
					depth: 1
				});
				this.drawPoints({
					// depth: 1,
					matrix: this._prepareMat()
				});
				this._needRedraw = false;
console.log('drawPoints', regl.stats)
				// tick.cancel();
				// }
			}
		});
		return regl;
	}

});

L.webGLPoints = function(options) {
    return new L.WebGLPoints(options);
};
