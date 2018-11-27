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

console.log('nnnnnn', options)

        try {
            this.gl = this._createGL(options.reglModules);
			// this._repaintGL();
        } catch (e) {
            console.error(e);
            
            // setup for webgl-less unit testing
            this.gl = {
                clear: function () {},
                update: function () {},
                multiply: function () {},
                addPoint: function () {},
                display: function () {},
                adjustSize: function () {},
            };
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
        delete this.gl;
        L.DomUtil.remove(this._container);
        L.DomEvent.off(this._container);
        delete this._container;
    },

    // events

    getEvents: function() {
        var events = L.Renderer.prototype.getEvents.call(this);

        L.Util.extend(events, {
            resize: this.resize,
            move: L.Util.throttle(this._update, 49, this)
        });

        return events;
    },

    resize: function() {
        var canvas = this._container,
            size = this._map.getSize();

        canvas.width = size.x;
        canvas.height = size.y;

        // this.gl.adjustSize();
        this.draw();
    },

    reposition: function() {
        // canvas moves opposite to map pane's position
        var pos = this._map
            ._getMapPanePos()
            .multiplyBy(-1);

        L.DomUtil.setPosition(this._container, pos);
    },

    _update: function() {
        L.Renderer.prototype._update.call(this);
        this.draw();
    },

    // scale methods 
/*
    _scalem: function(latlng) {
        // necessary to maintain accurately sized circles
        // to change scale to miles (for example), you will need to convert 40075017 (equatorial circumference of the Earth in metres) to miles
        var map = this._map,
            lngRadius = (this.size / 40075017) *
                360 / 
                Math.cos((Math.PI / 180) * latlng.lat),
            latlng2 = new L.LatLng(latlng.lat, latlng.lng - lngRadius),
            point = map.latLngToLayerPoint(latlng),
            point2 = map.latLngToLayerPoint(latlng2);

        return Math.max(Math.round(point.x - point2.x), 1);
    },

    _scalepx: function() {
        return this.size;
    },

    // affects original points
    multiply: function(n) {
        this._multiply = n;
        this.draw();
    },

    _createGL1: function(reglModules) {
		var regl = reglModules.regl({
			canvas: this._container
		});
		var drawTriangle = regl({
			frag: `
			void main() {
				gl_FragColor = vec4(1, 1, 0, 1);
			}`,

			vert: `
			attribute vec2 position;
			void main() {
				gl_Position = vec4(position, 0, 1);
			}`,

			attributes: {
				position: [[0, -1], [-1, 0], [1, 1]]
			},

			count: 3
		})

		// Here we register a per-frame callback to draw the whole scene
		regl.frame(function () {
			regl.clear({
				color: [0, 0, 0, 0]
			})

			// This tells regl to execute the command once for each object
			drawTriangle()
		});
		return regl;
    },

    _createGL2: function(reglModules) {
		var regl = reglModules.regl({
			canvas: this._container
		});
		const mat4 = reglModules.mat4;
		const hsv2rgb = reglModules.hsv2rgb;

		const NUM_POINTS = 1e4
		const VERT_SIZE = 4 * (4 + 4 + 3)

		const pointBuffer = regl.buffer(Array(NUM_POINTS).fill().map(function () {
		  const color = hsv2rgb(Math.random() * 360, 0.6, 1)
		  return [
			// freq
			Math.random() * 10,
			Math.random() * 10,
			Math.random() * 10,
			Math.random() * 10,
			// phase
			2.0 * Math.PI * Math.random(),
			2.0 * Math.PI * Math.random(),
			2.0 * Math.PI * Math.random(),
			2.0 * Math.PI * Math.random(),
			// color
			color[0] / 255, color[1] / 255, color[2] / 255
		  ]
		}))

		const drawParticles = regl({
		  vert: `
		  precision mediump float;
		  attribute vec4 freq, phase;
		  attribute vec3 color;
		  uniform float time;
		  uniform mat4 view, projection;
		  varying vec3 fragColor;
		  void main() {
			vec3 position = 8.0 * cos(freq.xyz * time + phase.xyz);
			gl_PointSize = 5.0 * (1.0 + cos(freq.w * time + phase.w));
			gl_Position = projection * view * vec4(position, 1);
			fragColor = color;
		  }`,

		  frag: `
		  precision lowp float;
		  varying vec3 fragColor;
		  void main() {
			if (length(gl_PointCoord.xy - 0.5) > 0.5) {
			  discard;
			}
			gl_FragColor = vec4(fragColor, 1);
		  }`,

		  attributes: {
			freq: {
			  buffer: pointBuffer,
			  stride: VERT_SIZE,
			  offset: 0
			},
			phase: {
			  buffer: pointBuffer,
			  stride: VERT_SIZE,
			  offset: 16
			},
			color: {
			  buffer: pointBuffer,
			  stride: VERT_SIZE,
			  offset: 32
			}
		  },

		  uniforms: {
			view: ({tick}) => {
			  const t = 0.01 * tick
			  return mat4.lookAt([],
				[30 * Math.cos(t), 2.5, 30 * Math.sin(t)],
				[0, 0, 0],
				[0, 1, 0])
			},
			projection: ({viewportWidth, viewportHeight}) =>
			  mat4.perspective([],
				Math.PI / 4,
				viewportWidth / viewportHeight,
				0.01,
				1000),
			time: ({tick}) => tick * 0.001
		  },

		  count: NUM_POINTS,

		  primitive: 'points'
		})

		regl.frame(() => {
		  regl.clear({
			depth: 1,
			color: [0, 0, 0, 0]
		  })

		  drawParticles()
		})

		return regl;
    },

*/
    // data handling methods

    data: [],

    addDataPoint: function(lat, lon, value) {
        this.data.push([lat, lon, value / 100]);
    },

    setData: function(dataset) {
        // format: [[lat, lon, intensity],...]
        this.data = dataset;
        this._multiply = null;
        this.draw();
    },

    clear: function() {
        this.setData([]);
    },

    // draw function

    draw: function() {
        var map = this._map,
            heatmap = this.gl,
            data = this.data,
            dataLen = data.length,
            floor = Math.floor,
            // scaleFn = this['_scale' + this.options.units].bind( this ),
            multiply = this._multiply;

        if (!map) return;

        // heatmap.clear();
        this.reposition();
		this._prepareMat();

/*
        if (dataLen) {

            for (var i = 0; i < dataLen; i++) {
                var dataVal = data[i],
                    latlng = L.latLng(dataVal),
                    point = map.latLngToContainerPoint(latlng);

                heatmap.addPoint(
                    floor(point.x),
                    floor(point.y),
                    scaleFn(latlng),
                    dataVal[2]
                );
            }

            heatmap.update();

            if (multiply) {
                heatmap.multiply(multiply);
                heatmap.update();
            }

        }
        heatmap.display();
		*/
    },

    _createGL: function(reglModules) {
		var regl = reglModules.regl({
			// profile: true,
			canvas: this._container
		});
		const mat4 = reglModules.mat4;
		const hsv2rgb = reglModules.hsv2rgb;

        this._prepareMat();
		// var vertArray = new Float32Array(verts);
        // var fsize = vertArray.BYTES_PER_ELEMENT;
		var data = [
		  // [50.10164799,14.44891924  ]
		  [43.953282, -78.252868]
		];
		const NUM_POINTS = data.length;
		const VERT_SIZE = 4 * 1;
		const WW = 40075016.685578496 / 2;

		const pointBuffer = regl.buffer({
			// data: [[0.5, 0.5, 0, 1]],
			data: data.map(function (it) {
				// var pixel = this._latLongToPixelXY(it[0], it[1]);
				var latlng = L.latLng(it[0], it[1]);
				var merc = L.CRS.EPSG3857.project(latlng);
				var arr = [merc.x / WW, merc.y / WW, 0, 1];
				// arr = [0, 0, 0, 1];
console.log('_____', arr);
				
				return arr;
				return [
					//-- 2 coord
					// 0.5, 0.5, 0, 1
					merc.x / WW, merc.y / WW, 0, 1
					// ,
					// 3 rgb colors interleaved buffer
					// Math.random(),
					// Math.random(),
					// Math.random()
				]
			}.bind(this)),
			type: 'float'
		});

		this.drawParticles = regl({
		  vert: `
			uniform mat4 u_matrix;
			attribute vec4 a_vertex;
			//attribute float a_pointSize;
			// attribute vec4 a_color;
			// varying vec4 v_color;

			void main() {
				// Set the size of the point
				gl_PointSize = 8.0;

				// multiply each vertex by a matrix.
				gl_Position = u_matrix * a_vertex;
				// gl_Position = a_vertex;


				// pass the color to the fragment shader
				// v_color = a_color;
 		  }`,

		  frag: `
			precision mediump float;
			// varying vec4 v_color;

			void main() {

				// float border = 0.05;
				// float radius = 0.5;
				// vec4 color0 = vec4(0.0, 0.0, 0.0, 0.0);
				// vec4 color0 = vec4(1.0, 1.0, 1.0, 1.0);
				// vec4 color1 = vec4(v_color[0], v_color[1], v_color[2], 0.2);
				// vec4 color1 = vec4(v_color[0], v_color[1], v_color[2], 1.0);

				// vec2 m = gl_PointCoord.xy - vec2(0.5, 0.5);
				// float dist = radius - sqrt(m.x * m.x + m.y * m.y);

				// float t = 0.0;
				// if (dist > border)
				// t = 1.0;
				// else if (dist > 0.0)
				// t = dist / border;

				// float centerDist = length(gl_PointCoord - 0.5);
				// works for overlapping circles if blending is enabled

				// gl_FragColor = mix(color0, color1, t);
				gl_FragColor = vec4(0.0, 0.0, 1.0, 1.0);

		  }`,

		  attributes: {
            // var pointSize = Math.max(leafletMap.getZoom() - 4.0, 1.0);
            // gl.vertexAttrib1f(gl.aPointSize, pointSize);
			// a_pointSize: 1.0,
			a_vertex: {
			  buffer: pointBuffer,
			  stride: VERT_SIZE,
			  offset: 0
			// },
			// a_color: {
			  // buffer: pointBuffer,
			  // stride: VERT_SIZE,
			  // offset: 0
			}
		  },

			// viewport: {
				// x: 0,
				// y: 0,
				// width: this._container.width / 2,
				// height: this._container.height / 2
			// },

		  uniforms: {
			// view: ({tick}) => {
			  // const t = 0.01 * tick
			  // return mat4.lookAt([],
				// [30 * Math.cos(t), 2.5, 30 * Math.sin(t)],
				// [0, 0, 0],
				// [0, 1, 0])
			// },
			// u_matrix: this.pixelsToWebGLMatrix
			u_matrix: this.pixelsToWebGLMatrix
				// ,
			// time: ({tick}) => tick * 0.001

		  },


		  count: NUM_POINTS,

		  primitive: 'points'
		});

		regl.frame(() => {
		  regl.clear({
			depth: 1,
			color: [0, 0, 0, 0]
		  })

		  this.drawParticles();
		});

		return regl;
    },

    _latLongToPixelXY: function(latitude, longitude) {
		var pi_180 = Math.PI / 180.0;
		var pi_4 = Math.PI * 4;
		var sinLatitude = Math.sin(latitude * pi_180);
		var pixelY = (0.5 - Math.log((1 + sinLatitude) / (1 - sinLatitude)) / (pi_4)) * 256;
		var pixelX = ((longitude + 180) / 360) * 256;

		var pixel = { x: pixelX, y: pixelY };

		return pixel;
    },

	_translateMatrix: function (matrix, tx, ty) {
		// translation is in last column of matrix
		matrix[12] += matrix[0] * tx + matrix[4] * ty;
		matrix[13] += matrix[1] * tx + matrix[5] * ty;
		matrix[14] += matrix[2] * tx + matrix[6] * ty;
		matrix[15] += matrix[3] * tx + matrix[7] * ty;
	},

	_scaleMatrix: function(matrix, scaleX, scaleY) {
		// scaling x and y, which is just scaling first two columns of matrix
		matrix[0] *= scaleX;
		matrix[1] *= scaleX;
		matrix[2] *= scaleX;
		matrix[3] *= scaleX;

		matrix[4] *= scaleY;
		matrix[5] *= scaleY;
		matrix[6] *= scaleY;
		matrix[7] *= scaleY;
	},

    _prepareMat: function() {
		var map = this._map,
			WW = 40075016.685578496,
			bounds = map.getBounds(),
			merc = L.CRS.EPSG3857.project(bounds.getNorthWest()),
			merc1 = L.CRS.EPSG3857.project(bounds.getSouthEast());

        this.pixelsToWebGLMatrix = new Float32Array(16);
        this.pixelsToWebGLMatrix.set([
			// 2 / this._container.width, 0, 0, 0,
			// 0, -2 / this._container.height, 0, 0,
			1, 	0, 0, 0,
			0,	-1, 0, 0,
			// 1 - merc.x / WW, 	0, 0, 0,
			// 0,	1 - merc.y / WW, 0, 0,
			0, 0, 0, 0,
			-1, 1, 0, 1
		]);
		this.pixelsToWebGLMatrix = this.options.reglModules.mat4.lookAt([],
				[0, 0, 0],
				[0, 1, 0],
				[1 - merc.x / WW, merc.y / WW - 1, 0]
			);
		this.pixelsToWebGLMatrix = this.options.reglModules.mat4.lookAt([],
				[0, 0, 0],
				[0, 1, 0],
				[-1, 0, 0]
			);
		// this.pixelsToWebGLMatrix = this.options.reglModules.mat4.ortho([],
				// 1 - merc.x / WW, 1 - merc1.x / WW,
				// merc1.y / WW - 1, merc.y / WW - 1,
				// 0, -1
			// );
		// this.pixelsToWebGLMatrix = [1, 0, 0, 1];
			// }
/*
ortho(out:mat4, left:number, right:number, bottom:number, top:number, near:number, far:number)
		var tt = this.options.reglModules.mat4.ortho(0, this._container.width, this._container.height, 0, -1, 1);
var matrix = m4.orthographic(0, gl.canvas.width, gl.canvas.height, 0, -1, 1);
        // var mapMatrix = new Float32Array(16);
		var map = this._map,
			WW = 40075016.685578496,
			bounds = map.getBounds(),
			merc = L.CRS.EPSG3857.project(bounds.getNorthWest()),
            topLeft = new L.LatLng(bounds.getNorth(), bounds.getWest()),
            offset = this._latLongToPixelXY(topLeft.lat, topLeft.lng),
            scale = Math.pow(2, map.getZoom());	// -- Scale to current zoom
		const pointBuffer = regl.buffer({
			// data: [[0.5, 0.5, 0, 1]],
			data: data.map(function (it) {
				// var pixel = this._latLongToPixelXY(it[0], it[1]);
				var latlng = L.latLng(it[0], it[1]);
				var merc = L.CRS.EPSG3857.project(latlng);
				
				return [
					//-- 2 coord
					// 0.5, 0.5, 0, 1
					merc.x / WW, merc.y / WW, 0, 1
*/
 		// console.log('_prepareMat0', JSON.stringify(this.pixelsToWebGLMatrix));
       // this._scaleMatrix(this.pixelsToWebGLMatrix, scale, scale);
		// this._translateMatrix(this.pixelsToWebGLMatrix, 1 - merc.x / WW, 1 - merc.y / WW);
		console.log('_prepareMat', this.pixelsToWebGLMatrix);

	}

});

L.webGLPoints = function(options) {
    return new L.WebGLPoints(options);
};

/*

// The default method exposed by the module wraps a canvas element
const regl = require('regl')()
const mat4 = require('gl-mat4')()

// This clears the color buffer to black and the depth buffer to 1
regl.clear({
  color: [0, 0, 0, 1],
  depth: 1
})

// In regl, draw operations are specified declaratively using. Each JSON
// command is a complete description of all state. This removes the need to
// .bind() things like buffers or shaders. All the boilerplate of setting up
// and tearing down state is automated.
regl({

  // In a draw call, we can pass the shader source code to regl
  frag: `
  precision mediump float;
  uniform vec4 color;
  void main () {
    gl_FragColor = color;
  }`,

  vert: `
  precision mediump float;
  attribute vec2 position;
  void main () {
    gl_Position = vec4(position, 0, 1);
  }`,

  attributes: {
    position: [
      [-1, 0],
      [0, -1],
      [1, 1]
    ]
  },

  uniforms: {
    color: [1, 0, 0, 1]
  },

  count: 3
})()
*/