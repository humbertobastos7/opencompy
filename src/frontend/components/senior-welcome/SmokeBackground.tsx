import { useEffect, useRef } from "react";

const VERTEX_SRC = `#version 300 es
precision highp float;
in vec4 position;
void main(){gl_Position=position;}`;

// Smoke-only shader: outputs transparent where there's no smoke,
// colored where smoke density is high. No opaque background.
const FRAGMENT_SRC = `#version 300 es
precision highp float;
out vec4 O;
uniform float time;
uniform vec2 resolution;
uniform vec3 u_color;

#define FC gl_FragCoord.xy
#define R resolution
#define T (time+660.)

float rnd(vec2 p){p=fract(p*vec2(12.9898,78.233));p+=dot(p,p+34.56);return fract(p.x*p.y);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p),u=f*f*(3.-2.*f);return mix(mix(rnd(i),rnd(i+vec2(1,0)),u.x),mix(rnd(i+vec2(0,1)),rnd(i+1.),u.x),u.y);}
float fbm(vec2 p){float t=.0,a=1.;for(int i=0;i<5;i++){t+=a*noise(p);p*=mat2(1,-1.2,.2,1.2)*2.;a*=.5;}return t;}

void main(){
  vec2 uv=(FC-.5*R)/R.y;
  uv.x+=.25;
  uv*=vec2(2,1);

  float n=fbm(uv*.28-vec2(T*.01,0));
  n=noise(uv*3.+n*2.);

  // These are the fbm values that were being subtracted from white.
  // High values = dense smoke areas.
  float r=fbm(uv+vec2(0,T*.015)+n);
  float g=fbm(uv*1.003+vec2(0,T*.015)+n+.003);
  float b=fbm(uv*1.006+vec2(0,T*.015)+n+.006);

  float density=(r+g+b)/3.0;

  // Smooth alpha: only paint where smoke is dense enough
  // Only the very lightest wisps (low density) are visible, with a power curve
  // so the transition is sharp — strong wisps, clean transparency elsewhere
  float invDensity = 1.0 - density;
  float alpha = pow(invDensity, 1.5);
  alpha *= min(time*0.5, 1.0); // reach full opacity in ~2s

  O=vec4(u_color, alpha);
}`;

const VERTICES = new Float32Array([-1, 1, -1, -1, 1, 1, 1, -1]);

function hexToRgb(hex: string): [number, number, number] {
	const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
	return m
		? [
				parseInt(m[1], 16) / 255,
				parseInt(m[2], 16) / 255,
				parseInt(m[3], 16) / 255,
			]
		: [0.12, 0.82, 0.82];
}

class SmokeRenderer {
	private gl: WebGL2RenderingContext;
	private program: WebGLProgram | null = null;
	private buffer: WebGLBuffer | null = null;
	private uResolution: WebGLUniformLocation | null = null;
	private uTime: WebGLUniformLocation | null = null;
	private uColor: WebGLUniformLocation | null = null;
	private color: [number, number, number];

	constructor(
		private canvas: HTMLCanvasElement,
		color: [number, number, number],
	) {
		this.gl = canvas.getContext("webgl2", {
			alpha: true,
			premultipliedAlpha: false,
		}) as WebGL2RenderingContext;
		this.color = color;
		this.build();
		// Standard alpha blending — avoids additive white saturation
		this.gl.enable(this.gl.BLEND);
		this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE_MINUS_SRC_ALPHA);
	}

	private compileShader(type: number, src: string): WebGLShader {
		const gl = this.gl;
		const shader = gl.createShader(type)!;
		gl.shaderSource(shader, src);
		gl.compileShader(shader);
		return shader;
	}

	private build() {
		const gl = this.gl;
		const vs = this.compileShader(gl.VERTEX_SHADER, VERTEX_SRC);
		const fs = this.compileShader(gl.FRAGMENT_SHADER, FRAGMENT_SRC);
		const prog = gl.createProgram()!;
		gl.attachShader(prog, vs);
		gl.attachShader(prog, fs);
		gl.linkProgram(prog);
		gl.deleteShader(vs);
		gl.deleteShader(fs);
		this.program = prog;

		this.buffer = gl.createBuffer();
		gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
		gl.bufferData(gl.ARRAY_BUFFER, VERTICES, gl.STATIC_DRAW);

		gl.useProgram(prog);
		const pos = gl.getAttribLocation(prog, "position");
		gl.enableVertexAttribArray(pos);
		gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0);

		this.uResolution = gl.getUniformLocation(prog, "resolution");
		this.uTime = gl.getUniformLocation(prog, "time");
		this.uColor = gl.getUniformLocation(prog, "u_color");
	}

	resize() {
		const dpr = Math.max(1, window.devicePixelRatio);
		const w = this.canvas.offsetWidth;
		const h = this.canvas.offsetHeight;
		this.canvas.width = w * dpr;
		this.canvas.height = h * dpr;
		this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
	}

	setColor(color: [number, number, number]) {
		this.color = color;
	}

	render(now: number) {
		const { gl, program, canvas } = this;
		if (!program) return;
		// Clear to fully transparent each frame
		gl.clearColor(0, 0, 0, 0);
		gl.clear(gl.COLOR_BUFFER_BIT);
		gl.useProgram(program);
		gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
		gl.uniform2f(this.uResolution, canvas.width, canvas.height);
		gl.uniform1f(this.uTime, now * 1e-3);
		gl.uniform3fv(this.uColor, this.color);
		gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
	}

	destroy() {
		if (this.program) this.gl.deleteProgram(this.program);
		if (this.buffer) this.gl.deleteBuffer(this.buffer);
	}
}

interface Props {
	smokeColor?: string;
	opacity?: number;
}

export const SmokeBackground: React.FC<Props> = ({
	smokeColor = "#0dcfcf",
	opacity = 0.88,
}) => {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const rendererRef = useRef<SmokeRenderer | null>(null);
	const rafRef = useRef<number>(0);

	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;
		if (!canvas.getContext("webgl2")) return;

		const renderer = new SmokeRenderer(canvas, hexToRgb(smokeColor));
		rendererRef.current = renderer;
		renderer.resize();

		const ro = new ResizeObserver(() => renderer.resize());
		ro.observe(canvas.parentElement ?? canvas);

		const loop = (now: number) => {
			renderer.render(now);
			rafRef.current = requestAnimationFrame(loop);
		};
		rafRef.current = requestAnimationFrame(loop);

		return () => {
			cancelAnimationFrame(rafRef.current);
			ro.disconnect();
			renderer.destroy();
			rendererRef.current = null;
		};
	}, []); // eslint-disable-line react-hooks/exhaustive-deps

	useEffect(() => {
		rendererRef.current?.setColor(hexToRgb(smokeColor));
	}, [smokeColor]);

	return (
		<canvas
			ref={canvasRef}
			style={{
				position: "absolute",
				inset: 0,
				width: "100%",
				height: "100%",
				display: "block",
				opacity,
				pointerEvents: "none",
			}}
		/>
	);
};
