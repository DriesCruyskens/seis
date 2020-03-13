import * as dat from 'dat-gui';
import { makeNoise3D } from "open-simplex-noise";
import * as paper from 'paper';
import { saveAs } from 'file-saver';
import * as _ from 'lodash';

export default class Seis {

    constructor(canvas_id) {
        this.params = {
            n_seis: 100000,
            l1_multiplier: 3,
            l1_sharpness: .7,
            l1_opacity: .88,
            l2_multiplier: .5,
            l2_sharpness: .7,
            l2_opacity: 0,
            l3_multiplier: .2,
            l3_sharpness: 0,
            l3_opacity: .7,
            amp: 3,
            n_noise: 2,
            seis_smooth: 50,
            noise_function: 'nf3',
            //draw_original_path: false,
            map_in_max: .4,
            theta_increment: 585,
            n_vertices: 600,
            seed: 1000,
            radius: 2.5,
            fade_origin: false,
            fade_edge: true,
            fade_dist: 260,
        }

        Number.prototype.map = function (in_min, in_max, out_min, out_max) {
            return (this - in_min) * (out_max - out_min) / (in_max - in_min) + out_min;
        }

        Number.prototype.clamp = function(min, max) {
            return Math.min(Math.max(this, min), max);
          };

        this.gui = new dat.GUI();
        this.canvas = document.getElementById(canvas_id);
        paper.setup(this.canvas);
        this.noise3D = makeNoise3D(Date.now());

        this.center = paper.view.center;

        this.init_gui();
        this.reset();
    }

    randomize() {
        this.noise3D = makeNoise3D(Date.now());
        this.reset()
    }

    reset() {
        paper.project.currentStyle = {
            strokeColor: 'black',
            //fillColor: '#0000FF01'
        };
        
        paper.project.clear();
        this.draw();
        paper.view.draw();
    }

    draw() {
        this.render();
    }

    make_joy_texture(n_vertices) {
        let coords = [];

        let r = _.range(this.params.inner_hole, 1, 1/n_vertices)    
        let theta = _.range(this.params.inner_hole, 1, 1/n_vertices)

        r.push(1)
        theta.push(1)

        for (let i = 0; i < n_vertices; i++) {
            coords.push([r[i], theta[i]])
        }

        return coords
    }

    render() {
        this.path = new paper.Path()
        const coords = this.make_joy_texture(this.params.n_vertices);
        coords.forEach(c => {
            if (c !== null) {
                this.path.add(new paper.Point(
                    this.position_texture(c[0], c[1])
                ))
            }
        })
        
        this.path.smooth({
            type: "geometric"
        })

        // removes last segments thats out of place because of missing handles
        this.path.removeSegment(this.path.segments.length-1)
        this.path.replaceWith(this.seisify(this.path, this.params.n_seis))
        //this.path2 = this.seisify(this.path, this.params.n_seis)
    }

    seisify(path_in, interval) {
        let path_out = new paper.Path()
        let offset, p, n, amp, d, fade, a1, a
        let r = paper.view.bounds.height / this.params.radius
        // mod: modulo: with modulo 2 every dot alternates left and right of the original path
        // mod 4: 2 consecutive dots left, 2 consecutive right etc..
        let mod = 2
        for (let i = 0; i < interval; i++) {
            offset = i/interval * path_in.length
            p = path_in.getPointAt(offset)
            a1 = 0
            a=0

            // noise functions

            amp = this.params.noise_function == 'nf1' ? this.noise_function_1(p) :
                  this.params.noise_function == 'nf2' ? this.noise_function_2(p) :
                  this.params.noise_function == 'nf3' ? this.noise_function_3(p) : null

            // add fade to center and edge
            d = this.center.getDistance(p)
            if (this.params.fade_origin) {
                fade =  Math.min(this.center.getDistance(p), this.params.fade_dist).map(0, this.params.fade_dist, 0, 1)
                fade = (--fade)*fade*fade+1 // easeOutCubic https://gist.github.com/gre/1650294, https://easings.net/en
                amp = amp * fade
            }
            
            if (this.params.fade_edge) {
                fade =  Math.min((r-d)*2,  this.params.fade_dist).map(0, this.params.fade_dist, 0, 1) // fading less at the edge than at origin
                fade = (--fade)*fade*fade+1 // easeOutCubic https://gist.github.com/gre/1650294, https://easings.net/en
                amp = amp * fade
            }
            

            // alternate vertices left and right of original path
            if (i % mod < mod/2) {
                n = path_in.getNormalAt(offset).multiply(amp).add(p)
            } else {
                n = path_in.getNormalAt(offset).multiply(-amp).add(p)
            }
            // add vertex to path
            path_out.add(n)
        }
        path_out.smooth({ type: 'geometric' })

        return path_out.sendToBack() // send to back makes it so that it gets drawn first before the original line
    }

    noise_function_4(p) {
        let noise
        let amp = 0
        let a = 0

        noise = this.noise3D(p.x/this.params.seis_smooth*this.params.l1_multiplier, p.y/this.params.seis_smooth*this.params.l1_multiplier, 0)
        a += noise.map(-0, 1-this.params.l1_sharpness, 0, 1)
        a = Math.abs(a)
        a = a.clamp(this.params.l1_opacity, 1)
        amp = amp + a

        noise = this.noise3D(p.x/this.params.seis_smooth*this.params.l2_multiplier, p.y/this.params.seis_smooth*this.params.l2_multiplier, 0)
        a += noise.map(-0, 1-this.params.l2_sharpness, 0, 1)
        a = Math.abs(a)
        a= a.clamp(this.params.l2_opacity, 1)
        amp = amp + a

        /*
        noise = this.noise3D(p.x/this.params.seis_smooth*this.params.l3_multiplier, p.y/this.params.seis_smooth*this.params.l3_multiplier, 0)
        a += noise.map(-1, 1-this.params.l3_sharpness, 0, 1)
        a = Math.abs(a)
        a = a.clamp(this.params.l3_opacity, 1)
        a = 1-a
        amp = amp - a
        amp = amp.clamp(0, 1) */

        // scale normalised to amp
        amp = amp * this.params.amp
        return amp
    }

    noise_function_3(p) {
        let noise
        let amp = 1
        let a = 0

        noise = this.noise3D(p.x/this.params.seis_smooth*this.params.l1_multiplier, p.y/this.params.seis_smooth*this.params.l1_multiplier, 0)
        a += noise.map(-0, 1-this.params.l1_sharpness, 0, 1)
        a = Math.abs(a)
        a = a.clamp(this.params.l1_opacity, 1)
        a = 1-a
        amp = amp - a
        amp = amp.clamp(0, 1)

        noise = this.noise3D(p.x/this.params.seis_smooth*this.params.l2_multiplier, p.y/this.params.seis_smooth*this.params.l2_multiplier, 0)
        a += noise.map(-0, 1-this.params.l2_sharpness, 0, 1)
        a = Math.abs(a)
        a= a.clamp(this.params.l2_opacity, 1)
        a = 1-a
        amp = amp - a
        amp = amp.clamp(0, 1)

        noise = this.noise3D(p.x/this.params.seis_smooth*this.params.l3_multiplier, p.y/this.params.seis_smooth*this.params.l3_multiplier, 0)
        a += noise.map(-1, 1-this.params.l3_sharpness, 0, 1)
        a = Math.abs(a)
        a = a.clamp(this.params.l3_opacity, 1)
        a = 1-a
        amp = amp - a
        amp = amp.clamp(0, 1)

        // scale normalised to amp
        amp = amp * this.params.amp
        return amp
    }

    noise_function_2(p) {
        let noise
        let amp = 1
        let a1 = 0
        let a = 0

        noise = this.noise3D(p.x/this.params.seis_smooth*this.params.l2_multiplier, p.y/this.params.seis_smooth*this.params.l2_multiplier, 0)
        a1 += noise.map(-0, 1-this.params.l2_sharpness, 0, 1)
        a1 = Math.abs(a1)
        a1= a1.clamp(this.params.l2_opacity, 1)
        a1 = 1-a1

        noise = this.noise3D(p.x/this.params.seis_smooth*this.params.l1_multiplier, p.y/this.params.seis_smooth*this.params.l1_multiplier, 0)
        a += noise.map(-0, 1-a1, 0, 1)
        a = Math.abs(a)
        a = a.clamp(a1, 1) // a = a.clamp(a1, 1)
        a = 1-a
        amp = amp - a
        amp = amp.clamp(0, 1)

        noise = this.noise3D(p.x/this.params.seis_smooth*this.params.l3_multiplier, p.y/this.params.seis_smooth*this.params.l3_multiplier, 0)
        a += noise.map(-1, 1-this.params.l3_sharpness, 0, 1)
        a = Math.abs(a)
        a = a.clamp(this.params.l3_opacity, 1)
        a = 1-a
        amp = amp - a
        amp = amp.clamp(0, 1)

        // scale normalised to amp
        amp = amp * this.params.amp
        return amp
    }
    
    noise_function_1(p) {
        let noise
        let amp = 1
        let a1 = 0
        let a = 0

        noise = this.noise3D(p.x/this.params.seis_smooth*this.params.l2_multiplier, p.y/this.params.seis_smooth*this.params.l2_multiplier, 0)
        a1 += noise.map(-0, 1-this.params.l2_sharpness, 0, 1)
        a1 = Math.abs(a1)
        a1= a1.clamp(this.params.l2_opacity, 1)
        a1 = 1-a1

        noise = this.noise3D(p.x/this.params.seis_smooth*this.params.l1_multiplier, p.y/this.params.seis_smooth*this.params.l1_multiplier, 0)
        a += noise.map(-0, 1-a1, 0, 1)
        a = Math.abs(a)
        a = a.clamp(0, 1) // a = a.clamp(a1, 1)
        a = 1-a
        amp = amp - a
        amp = amp.clamp(0, 1)

        noise = this.noise3D(p.x/this.params.seis_smooth*this.params.l3_multiplier, p.y/this.params.seis_smooth*this.params.l3_multiplier, 0)
        a += noise.map(-1, 1-this.params.l3_sharpness, 0, 1)
        a = Math.abs(a)
        a = a.clamp(this.params.l3_opacity, 1)
        a = 1-a
        amp = amp - a
        amp = amp.clamp(0, 1)

        // scale normalised to amp
        amp = amp * this.params.amp
        return amp
    }

    position_texture(r, theta) {
        const height = paper.view.bounds.height / this.params.radius;
        const width = paper.view.bounds.width / this.params.radius;

        let radius;
        if (width > height) {
            radius = height;
        } else {
            radius = width;
        }

        let x = r * Math.cos(theta*this.params.theta_increment) * radius + paper.view.center.x;
        let y = r * Math.sin(theta*this.params.theta_increment) * radius + paper.view.center.y;
        
        return [x, y]
    }

    init_gui() {
        /* this.gui.add(this.params, 'draw_original_path').onChange((value) => {
            this.path.visible = value
            paper.view.draw()
        }); */

        this.gui.add(this, 'randomize').name('Randomize');

        let seis = this.gui.addFolder('seis');

        seis.add(this.params, 'n_seis', 0, 120000).step(1).onFinishChange((value) => {
            this.params.n_seis = value;
            this.reset();
        });

        seis.add(this.params, 'amp', 0, 20).onFinishChange((value) => {
            this.params.amp = value;
            this.reset();
        });

        seis.add(this.params, 'fade_origin').onFinishChange((value) => {
            this.params.fade_origin = value;
            this.reset();
        });

        seis.add(this.params, 'fade_edge').onFinishChange((value) => {
            this.params.fade_edge = value;
            this.reset();
        });

        seis.add(this.params, 'fade_dist', 0, 1000).onFinishChange((value) => {
            this.params.fade_dist = value;
            this.reset();
        });

        seis.add(this.params, 'seis_smooth', 0, 200).onFinishChange((value) => {
            this.params.seis_smooth = value;
            this.reset();
        });

        let l1 = this.gui.addFolder('l1');

        l1.add(this.params, 'l1_multiplier', 0, 6).onFinishChange((value) => {
            this.params.l1_multiplier = value;
            this.reset();
        });

        l1.add(this.params, 'l1_sharpness', 0, 1).onFinishChange((value) => {
            this.params.l1_sharpness = value;
            this.reset();
        });

        l1.add(this.params, 'l1_opacity', 0.0, 1.0).onFinishChange((value) => {
            this.params.l1_opacity = value;
            this.reset();
        });

        let l2 = this.gui.addFolder('l2');

        l2.add(this.params, 'l2_multiplier', 0, 6).onFinishChange((value) => {
            this.params.l2_multiplier = value;
            this.reset();
        });

        l2.add(this.params, 'l2_sharpness', 0.0, 1.0).onFinishChange((value) => {
            this.params.l2_sharpness = value;
            this.reset();
        });

        l2.add(this.params, 'l2_opacity', 0.0, 1.0).onFinishChange((value) => {
            this.params.l2_opacity = value;
            this.reset();
        });

        let l3 = this.gui.addFolder('l3');

        l3.add(this.params, 'l3_multiplier', 0, 6).onFinishChange((value) => {
            this.params.l3_multiplier = value;
            this.reset();
        });

        l3.add(this.params, 'l3_sharpness', 0.0, 1.0).onFinishChange((value) => {
            this.params.l3_sharpness = value;
            this.reset();
        });

        l3.add(this.params, 'l3_opacity', 0.0, 1.0).onFinishChange((value) => {
            this.params.l3_opacity = value;
            this.reset();
        });

        let noise = this.gui.addFolder('noise');

        noise.add(this.params, 'seed', 0, 2000).onFinishChange((value) => {
            this.params.seed = value;
            this.reset();
        });

        noise.add(this.params, 'noise_function', ['nf1', 'nf2', 'nf3']).onFinishChange((value) => {
            this.params.noise_function = value;
            this.reset();
        });

        let shape = this.gui.addFolder('shape');

        shape.add(this.params, 'theta_increment', 0, 2000).step(1).onFinishChange((value) => {
            this.params.theta_increment = value;
            this.reset();
        });
        
        shape.add(this.params, 'n_vertices', 0, 2000).step(1).onFinishChange((value) => {
            this.params.n_vertices = value;
            this.reset();
        });
        

        shape.add(this.params, 'radius', 2, 10).onFinishChange((value) => {
            this.params.radius = value;
            this.reset();
        });

        this.gui.add(this, 'exportSVG').name('Export SVG');
    }

    exportSVG() {
        var svg = paper.project.exportSVG({asString: true});
        var blob = new Blob([svg], {type: "image/svg+xml;charset=utf-8"});
        saveAs(blob, 'Seis' + JSON.stringify(this.params) + '.svg');
    }
}