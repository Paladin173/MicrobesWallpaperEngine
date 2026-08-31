class MicrobesWebGLRenderer {
  static MAX_AUTO_PIXELS = 8294400;

  constructor(canvas, scene, quality = 'auto') {
    this.canvas = canvas;
    this.scene = scene;
    this.quality = quality;
    this.zoom = 1;
    this.resources = [];
    this.contextLost = false;
    this.visibleLayers = new Set(['decoration', 'corpse', 'food', 'microbe']);
    this.gl = canvas.getContext('webgl2', {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      desynchronized: true,
      powerPreference: 'high-performance'
    });

    if (!this.gl) {
      throw new Error('WebGL 2 is required to render this wallpaper.');
    }

    canvas.addEventListener('webglcontextlost', event => {
      event.preventDefault();
      this.contextLost = true;
    });
    canvas.addEventListener('webglcontextrestored', () => {
      this.contextLost = false;
      this.resources = [];
      this.createResources();
      this.resize();
    });

    this.createResources();
    this.resize();
  }

  createResources() {
    const gl = this.gl;
    this.deleteResources();
    this.quadBuffer = this.createBuffer(new Float32Array([
      -0.5, -0.5, 0.5, -0.5, -0.5, 0.5,
      -0.5, 0.5, 0.5, -0.5, 0.5, 0.5
    ]));
    this.resources.push(this.quadBuffer);
    this.layers = {
      decoration: this.createLayer(
        MicrobesWebGLRenderer.vertexShader('decoration'),
        MicrobesWebGLRenderer.decorationFragmentShader,
        this.scene.decorations,
        4
      ),
      corpse: this.createLayer(
        MicrobesWebGLRenderer.vertexShader('corpse'),
        MicrobesWebGLRenderer.corpseFragmentShader,
        this.scene.corpses,
        4
      ),
      food: this.createLayer(
        MicrobesWebGLRenderer.vertexShader('food'),
        MicrobesWebGLRenderer.foodFragmentShader,
        this.scene.food,
        4
      ),
      microbe: this.createLayer(
        MicrobesWebGLRenderer.vertexShader('microbe'),
        MicrobesWebGLRenderer.microbeFragmentShader,
        this.scene.microbes,
        8
      )
    };

    gl.disable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
    gl.clearColor(0, 0, 0.012, 1);
  }

  createLayer(vertexSource, fragmentSource, data, strideFloats) {
    const gl = this.gl;
    const program = this.createProgram(vertexSource, fragmentSource);
    const vao = gl.createVertexArray();
    const instanceBuffer = this.createBuffer(data, gl.DYNAMIC_DRAW);
    this.resources.push(program, vao, instanceBuffer);
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
    const vertexLocation = gl.getAttribLocation(program, 'aVertex');
    gl.enableVertexAttribArray(vertexLocation);
    gl.vertexAttribPointer(vertexLocation, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, instanceBuffer);
    const stride = strideFloats * 4;
    const transformLocation = gl.getAttribLocation(program, 'aTransform');
    gl.enableVertexAttribArray(transformLocation);
    gl.vertexAttribPointer(transformLocation, 4, gl.FLOAT, false, stride, 0);
    gl.vertexAttribDivisor(transformLocation, 1);
    const appearanceLocation = gl.getAttribLocation(program, 'aAppearance');
    if (appearanceLocation >= 0) {
      gl.enableVertexAttribArray(appearanceLocation);
      gl.vertexAttribPointer(appearanceLocation, 4, gl.FLOAT, false, stride, 16);
      gl.vertexAttribDivisor(appearanceLocation, 1);
    }
    gl.bindVertexArray(null);
    return {
      program,
      vao,
      instanceBuffer,
      data,
      strideFloats,
      count: data.length / strideFloats,
      viewportLocation: gl.getUniformLocation(program, 'uViewport'),
      timeLocation: gl.getUniformLocation(program, 'uTime'),
      zoomLocation: gl.getUniformLocation(program, 'uZoom')
    };
  }

  draw(timeSeconds) {
    if (this.contextLost) return;
    const gl = this.gl;
    gl.clear(gl.COLOR_BUFFER_BIT);
    for (const name of ['decoration', 'corpse', 'food', 'microbe']) {
      const layer = this.layers[name];
      const capacity = Math.floor(layer.data.length / layer.strideFloats);
      const requestedCount = this.scene[`${name}Count`] ?? capacity;
      layer.count = Math.max(0, Math.min(capacity, requestedCount));
      if (this.visibleLayers.has(name)) this.drawLayer(layer, timeSeconds);
    }
  }

  drawLayer(layer, timeSeconds) {
    const gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, layer.instanceBuffer);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, layer.data, 0, layer.count * layer.strideFloats);
    gl.useProgram(layer.program);
    gl.uniform2f(layer.viewportLocation, this.canvas.width, this.canvas.height);
    if (layer.timeLocation) gl.uniform1f(layer.timeLocation, timeSeconds);
    if (layer.zoomLocation) gl.uniform1f(layer.zoomLocation, this.zoom);
    gl.bindVertexArray(layer.vao);
    gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, layer.count);
  }

  resize() {
    if (this.contextLost) return false;
    const rect = this.canvas.getBoundingClientRect();
    const scale = this.resolveRenderScale(rect.width, rect.height);
    const width = Math.max(1, Math.round(rect.width * scale));
    const height = Math.max(1, Math.round(rect.height * scale));
    if (this.canvas.width === width && this.canvas.height === height) return false;
    this.canvas.width = width;
    this.canvas.height = height;
    this.gl.viewport(0, 0, width, height);
    return true;
  }

  setQuality(quality) {
    this.quality = quality;
    this.resize();
  }

  setZoom(zoom) {
    this.zoom = Math.max(0.5, Math.min(2, Number(zoom) || 1));
  }

  screenToWorld(x, y) {
    const minimum = (1 - 1 / this.zoom) / 2;
    const maximum = (1 + 1 / this.zoom) / 2;
    return {
      x: Math.max(minimum, Math.min(maximum, ((x * 2 - 1) / this.zoom + 1) / 2)),
      y: Math.max(minimum, Math.min(maximum, (1 - (1 - y * 2) / this.zoom) / 2))
    };
  }

  setVisibleLayers(names) {
    this.visibleLayers = new Set(names);
  }

  resolveRenderScale(width, height) {
    if (this.quality === 'high') return window.devicePixelRatio || 1;
    if (this.quality === 'balanced') return 0.75;
    if (this.quality === 'performance') return 0.5;
    const nativeScale = window.devicePixelRatio || 1;
    const nativePixels = width * height * nativeScale * nativeScale;
    return Math.min(
      nativeScale,
      Math.sqrt(MicrobesWebGLRenderer.MAX_AUTO_PIXELS / Math.max(1, nativePixels))
    );
  }

  getDiagnostics() {
    const gl = this.gl;
    return {
      renderer: gl.getParameter(gl.RENDERER),
      version: gl.getParameter(gl.VERSION),
      contextLost: this.contextLost,
      zoom: this.zoom,
      drawingBufferWidth: gl.drawingBufferWidth,
      drawingBufferHeight: gl.drawingBufferHeight,
      glError: gl.getError(),
      layerCounts: {
        decoration: this.layers.decoration.count,
        corpse: this.layers.corpse.count,
        food: this.layers.food.count,
        microbe: this.layers.microbe.count
      }
    };
  }

  createBuffer(data, usage = this.gl.STATIC_DRAW) {
    const buffer = this.gl.createBuffer();
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, buffer);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, data, usage);
    return buffer;
  }

  createProgram(vertexSource, fragmentSource) {
    const gl = this.gl;
    const vertex = this.compileShader(gl.VERTEX_SHADER, vertexSource);
    const fragment = this.compileShader(gl.FRAGMENT_SHADER, fragmentSource);
    const program = gl.createProgram();
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    gl.deleteShader(vertex);
    gl.deleteShader(fragment);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const message = gl.getProgramInfoLog(program);
      gl.deleteProgram(program);
      throw new Error(`Unable to link WebGL program: ${message}`);
    }
    return program;
  }

  compileShader(type, source) {
    const gl = this.gl;
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const message = gl.getShaderInfoLog(shader);
      gl.deleteShader(shader);
      throw new Error(`Unable to compile WebGL shader: ${message}`);
    }
    return shader;
  }

  deleteResources() {
    if (!this.gl || !this.resources.length) return;
    for (const resource of this.resources) {
      if (this.gl.isProgram(resource)) this.gl.deleteProgram(resource);
      else if (this.gl.isVertexArray(resource)) this.gl.deleteVertexArray(resource);
      else if (this.gl.isBuffer(resource)) this.gl.deleteBuffer(resource);
    }
    this.resources = [];
  }

  static vertexShader(layer) {
    const layerInputs = layer === 'microbe'
      ? 'in vec4 aAppearance;\nout vec4 vAppearance;'
      : layer === 'decoration'
        ? 'out float vDepth;'
        : '';
    const layerOutputs = layer === 'microbe'
      ? 'vAppearance = aAppearance;'
      : layer === 'decoration'
        ? 'vDepth = aTransform.z;'
        : '';
    const size = layer === 'decoration'
      ? '200.0 * mix(0.5, 1.0, aTransform.z)'
      : layer === 'food'
        ? '10.0 * (cos(uTime * 2.0 + aTransform.z * 10.0) * 0.2 + 0.7)'
        : 'aTransform.w';
    const scale = layer === 'decoration'
      ? 'min(uViewport.y / 800.0, 1.3)'
      : 'uViewport.y / 800.0';
    const drift = layer === 'decoration'
      ? 'vec2(sin((uTime + aTransform.x) * 0.1), cos((uTime + aTransform.y) * 0.1)) * mix(0.025, 0.09, aTransform.z)'
      : 'vec2(0.0)';
    const center = layer === 'decoration'
      ? `(aTransform.xy + ${drift}) * mix(0.2, 0.9, aTransform.z)`
      : 'aTransform.xy';
    return `#version 300 es
      precision highp float;
      in vec2 aVertex;
      in vec4 aTransform;
      ${layerInputs}
      uniform vec2 uViewport;
      uniform float uTime;
      uniform float uZoom;
      out vec2 vLocal;
      void main() {
        float size = ${size} * ${scale};
        vec2 center = ${center};
        float cosine = cos(aTransform.z);
        float sine = sin(aTransform.z);
        mat2 rotation = mat2(cosine, sine, -sine, cosine);
        vec2 pixelOffset = rotation * aVertex * size;
        gl_Position = vec4((center + pixelOffset * 2.0 / uViewport) * uZoom, 0.0, 1.0);
        vLocal = aVertex;
        ${layerOutputs}
      }`;
  }

  static decorationFragmentShader = `#version 300 es
    precision mediump float;
    in vec2 vLocal;
    in float vDepth;
    out vec4 outputColor;
    void main() {
      float d = length(vLocal) * 2.0;
      float alpha = mix(0.03, 0.08, vDepth) * exp(-d * d * 4.0);
      outputColor = vec4(0.6, 0.6, 1.0, alpha);
    }`;

  static corpseFragmentShader = `#version 300 es
    precision mediump float;
    in vec2 vLocal;
    out vec4 outputColor;
    void main() {
      float d = length(vLocal * vec2(1.0, 1.35)) * 2.0;
      float shell = exp(-pow((d - 0.55) * 8.0, 2.0));
      outputColor = vec4(0.55, 0.6, 0.7, shell * 0.24);
    }`;

  static foodFragmentShader = `#version 300 es
    precision mediump float;
    in vec2 vLocal;
    out vec4 outputColor;
    void main() {
      float d = length(vLocal) * 2.0;
      outputColor = vec4(0.75, 0.85, 1.0, exp(-d * d * 4.0));
    }`;

  static microbeFragmentShader = `#version 300 es
    precision mediump float;
    in vec2 vLocal;
    in vec4 vAppearance;
    out vec4 outputColor;
    void main() {
      float forward = smoothstep(-0.15, 0.5, vLocal.x);
      float taper = mix(1.0, 1.22, forward);
      float widthScale = 1.0 / mix(0.5, 0.9, vAppearance.a);
      float shellDistance = length(vLocal * vec2(1.0, widthScale * taper)) * 2.0;
      float shell = clamp(-pow(shellDistance - 0.4, 2.0) * 30.0 + 0.5, 0.0, 0.5);
      float bodyDistance = length(vLocal * vec2(1.0, ((widthScale - 1.0) * 0.2 + 1.0) * taper)) * 2.0;
      float body = clamp(-bodyDistance + 1.0, 0.0, 0.5);
      outputColor = vec4(min(vec3(1.0), vAppearance.rgb * 1.1), shell + body);
    }`;
}