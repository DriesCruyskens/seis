import * as dat from 'dat-gui';
import { makeNoise3D } from "open-simplex-noise";
import * as paper from 'paper';
import { saveAs } from 'file-saver';
import * as _ from 'lodash';

export default class Seis {

    constructor(canvas_id) {
        this.params = {
            n_seis: 80000,
            amp: 3,
            n_noise: 2,
            seis_smooth: 50,
            //draw_original_path: false,
            noise_ratio: .56,
            theta_increment: 585,
            n_vertices: 600,
            seed: 1000,
            radius: 2.5,
            fade_dist: 100,
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
        let offset, p, n, amp, r, noise
        
        // mod: modulo: with modulo 2 every dot alternates left and right of the original path
        // mod 4: 2 consecutive dots left, 2 consecutive right etc..
        let mod = 2
        for (let i = 0; i < interval; i++) {
            offset = i/interval * path_in.length
            p = path_in.getPointAt(offset)
            amp = 0

            
            // noise functions
            //amp = this.params.amp

            /* noise = this.noise3D(p.x/this.params.seis_smooth*.25, p.y/this.params.seis_smooth*.25, 20000)
            amp += noise.map(-1, 1, 0, this.params.amp*.5) */

            noise = this.noise3D(p.x/this.params.seis_smooth, p.y/this.params.seis_smooth, 10000)
            amp += noise.map(-0, .4, 0, this.params.amp*this.params.noise_ratio)

            /*
            noise = this.noise3D(p.x/this.params.seis_smooth/4, p.y/this.params.seis_smooth/4, 0)
            amp += noise.map(-1, 1, 0, this.params.amp*.2) */

            for (let i = 0; i < this.params.n_noise; i++) {
                noise = this.noise3D(p.x/((i+1)*4), p.y/((i+1)*4), Math.random() * 100000)
                amp += noise.map(-1, 1, 0, this.params.amp * ((1-this.params.noise_ratio)/this.params.n_noise))
            }

            // fade near origin and edge
            /* amp = amp * Math.min(this.center.getDistance(p), this.params.fade_dist).map(0, this.params.fade_dist, .6, 1)
            r = paper.view.bounds.width / this.params.radius
            amp = amp * Math.min(r-this.center.getDistance(p), this.params.fade_dist).map(0, this.params.fade_dist, .5, 1) */

            if (i % mod < mod/2) {
                n = path_in.getNormalAt(offset).multiply(amp).add(p)
            } else {
                n = path_in.getNormalAt(offset).multiply(-amp).add(p)
            }
            path_out.add(n)
        }
        path_out.smooth({ type: 'geometric' })
        //path_in.replaceWith(path_out)
        return path_out.sendToBack() // send to back makes it so that it gets drawn first before the original line
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

        seis.add(this.params, 'n_seis', 0, 100000).step(1).onFinishChange((value) => {
            this.params.n_seis = value;
            this.reset();
        });

        seis.add(this.params, 'amp', 0, 20).onChange((value) => {
            this.params.amp = value;
            this.reset();
        });

        seis.add(this.params, 'seis_smooth', 0, 200).onChange((value) => {
            this.params.seis_smooth = value;
            this.reset();
        });

        seis.add(this.params, 'fade_dist', 0, 400).onFinishChange((value) => {
            this.params.fade_dist = value;
            this.reset();
        });

        let noise = this.gui.addFolder('noise');

        noise.add(this.params, 'seed', 0, 2000).onChange((value) => {
            this.params.seed = value;
            this.reset();
        });

        noise.add(this.params, 'noise_ratio', 0, 1).onFinishChange((value) => {
            this.params.noise_ratio = value;
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