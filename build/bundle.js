var app = (function () {
    'use strict';

    function noop() { }
    const identity = x => x;
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }
    function is_empty(obj) {
        return Object.keys(obj).length === 0;
    }

    const is_client = typeof window !== 'undefined';
    let now = is_client
        ? () => window.performance.now()
        : () => Date.now();
    let raf = is_client ? cb => requestAnimationFrame(cb) : noop;

    const tasks = new Set();
    function run_tasks(now) {
        tasks.forEach(task => {
            if (!task.c(now)) {
                tasks.delete(task);
                task.f();
            }
        });
        if (tasks.size !== 0)
            raf(run_tasks);
    }
    /**
     * Creates a new task that runs on each raf frame
     * until it returns a falsy value or is aborted
     */
    function loop(callback) {
        let task;
        if (tasks.size === 0)
            raf(run_tasks);
        return {
            promise: new Promise(fulfill => {
                tasks.add(task = { c: callback, f: fulfill });
            }),
            abort() {
                tasks.delete(task);
            }
        };
    }

    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        node.parentNode.removeChild(node);
    }
    function destroy_each(iterations, detaching) {
        for (let i = 0; i < iterations.length; i += 1) {
            if (iterations[i])
                iterations[i].d(detaching);
        }
    }
    function element(name) {
        return document.createElement(name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function empty() {
        return text('');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function set_data(text, data) {
        data = '' + data;
        if (text.wholeText !== data)
            text.data = data;
    }
    function toggle_class(element, name, toggle) {
        element.classList[toggle ? 'add' : 'remove'](name);
    }
    function custom_event(type, detail) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, false, false, detail);
        return e;
    }

    const active_docs = new Set();
    let active = 0;
    // https://github.com/darkskyapp/string-hash/blob/master/index.js
    function hash(str) {
        let hash = 5381;
        let i = str.length;
        while (i--)
            hash = ((hash << 5) - hash) ^ str.charCodeAt(i);
        return hash >>> 0;
    }
    function create_rule(node, a, b, duration, delay, ease, fn, uid = 0) {
        const step = 16.666 / duration;
        let keyframes = '{\n';
        for (let p = 0; p <= 1; p += step) {
            const t = a + (b - a) * ease(p);
            keyframes += p * 100 + `%{${fn(t, 1 - t)}}\n`;
        }
        const rule = keyframes + `100% {${fn(b, 1 - b)}}\n}`;
        const name = `__svelte_${hash(rule)}_${uid}`;
        const doc = node.ownerDocument;
        active_docs.add(doc);
        const stylesheet = doc.__svelte_stylesheet || (doc.__svelte_stylesheet = doc.head.appendChild(element('style')).sheet);
        const current_rules = doc.__svelte_rules || (doc.__svelte_rules = {});
        if (!current_rules[name]) {
            current_rules[name] = true;
            stylesheet.insertRule(`@keyframes ${name} ${rule}`, stylesheet.cssRules.length);
        }
        const animation = node.style.animation || '';
        node.style.animation = `${animation ? `${animation}, ` : ''}${name} ${duration}ms linear ${delay}ms 1 both`;
        active += 1;
        return name;
    }
    function delete_rule(node, name) {
        const previous = (node.style.animation || '').split(', ');
        const next = previous.filter(name
            ? anim => anim.indexOf(name) < 0 // remove specific animation
            : anim => anim.indexOf('__svelte') === -1 // remove all Svelte animations
        );
        const deleted = previous.length - next.length;
        if (deleted) {
            node.style.animation = next.join(', ');
            active -= deleted;
            if (!active)
                clear_rules();
        }
    }
    function clear_rules() {
        raf(() => {
            if (active)
                return;
            active_docs.forEach(doc => {
                const stylesheet = doc.__svelte_stylesheet;
                let i = stylesheet.cssRules.length;
                while (i--)
                    stylesheet.deleteRule(i);
                doc.__svelte_rules = {};
            });
            active_docs.clear();
        });
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }
    function get_current_component() {
        if (!current_component)
            throw new Error('Function called outside component initialization');
        return current_component;
    }
    function onMount(fn) {
        get_current_component().$$.on_mount.push(fn);
    }

    const dirty_components = [];
    const binding_callbacks = [];
    const render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    let flushing = false;
    const seen_callbacks = new Set();
    function flush() {
        if (flushing)
            return;
        flushing = true;
        do {
            // first, call beforeUpdate functions
            // and update components
            for (let i = 0; i < dirty_components.length; i += 1) {
                const component = dirty_components[i];
                set_current_component(component);
                update(component.$$);
            }
            set_current_component(null);
            dirty_components.length = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        flushing = false;
        seen_callbacks.clear();
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }

    let promise;
    function wait() {
        if (!promise) {
            promise = Promise.resolve();
            promise.then(() => {
                promise = null;
            });
        }
        return promise;
    }
    function dispatch(node, direction, kind) {
        node.dispatchEvent(custom_event(`${direction ? 'intro' : 'outro'}${kind}`));
    }
    const outroing = new Set();
    let outros;
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function transition_out(block, local, detach, callback) {
        if (block && block.o) {
            if (outroing.has(block))
                return;
            outroing.add(block);
            outros.c.push(() => {
                outroing.delete(block);
                if (callback) {
                    if (detach)
                        block.d(1);
                    callback();
                }
            });
            block.o(local);
        }
    }
    const null_transition = { duration: 0 };
    function create_in_transition(node, fn, params) {
        let config = fn(node, params);
        let running = false;
        let animation_name;
        let task;
        let uid = 0;
        function cleanup() {
            if (animation_name)
                delete_rule(node, animation_name);
        }
        function go() {
            const { delay = 0, duration = 300, easing = identity, tick = noop, css } = config || null_transition;
            if (css)
                animation_name = create_rule(node, 0, 1, duration, delay, easing, css, uid++);
            tick(0, 1);
            const start_time = now() + delay;
            const end_time = start_time + duration;
            if (task)
                task.abort();
            running = true;
            add_render_callback(() => dispatch(node, true, 'start'));
            task = loop(now => {
                if (running) {
                    if (now >= end_time) {
                        tick(1, 0);
                        dispatch(node, true, 'end');
                        cleanup();
                        return running = false;
                    }
                    if (now >= start_time) {
                        const t = easing((now - start_time) / duration);
                        tick(t, 1 - t);
                    }
                }
                return running;
            });
        }
        let started = false;
        return {
            start() {
                if (started)
                    return;
                delete_rule(node);
                if (is_function(config)) {
                    config = config();
                    wait().then(go);
                }
                else {
                    go();
                }
            },
            invalidate() {
                started = false;
            },
            end() {
                if (running) {
                    cleanup();
                    running = false;
                }
            }
        };
    }
    function create_component(block) {
        block && block.c();
    }
    function mount_component(component, target, anchor, customElement) {
        const { fragment, on_mount, on_destroy, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        if (!customElement) {
            // onMount happens before the initial afterUpdate
            add_render_callback(() => {
                const new_on_destroy = on_mount.map(run).filter(is_function);
                if (on_destroy) {
                    on_destroy.push(...new_on_destroy);
                }
                else {
                    // Edge case - component was destroyed immediately,
                    // most likely as a result of a binding initialising
                    run_all(new_on_destroy);
                }
                component.$$.on_mount = [];
            });
        }
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const $$ = component.$$ = {
            fragment: null,
            ctx: null,
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            on_disconnect: [],
            before_update: [],
            after_update: [],
            context: new Map(parent_component ? parent_component.$$.context : options.context || []),
            // everything else
            callbacks: blank_object(),
            dirty,
            skip_bound: false
        };
        let ready = false;
        $$.ctx = instance
            ? instance(component, options.props || {}, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if (!$$.skip_bound && $$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor, options.customElement);
            flush();
        }
        set_current_component(parent_component);
    }
    /**
     * Base class for Svelte components. Used when dev=false.
     */
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set($$props) {
            if (this.$$set && !is_empty($$props)) {
                this.$$.skip_bound = true;
                this.$$set($$props);
                this.$$.skip_bound = false;
            }
        }
    }

    /* src\components\Header.svelte generated by Svelte v3.37.0 */

    function create_fragment$5(ctx) {
    	let header;
    	let div;
    	let img;
    	let img_src_value;
    	let t0;
    	let h1;
    	let t1_value = /*details*/ ctx[0].fullName + "";
    	let t1;
    	let t2;
    	let span0;
    	let t3_value = /*details*/ ctx[0].profession + "";
    	let t3;
    	let t4;
    	let span1;
    	let t5_value = /*details*/ ctx[0].location + "";
    	let t5;
    	let t6;
    	let span2;
    	let t7_value = /*details*/ ctx[0].phone + "";
    	let t7;
    	let t8;
    	let span3;
    	let t9_value = /*details*/ ctx[0].email + "";
    	let t9;

    	return {
    		c() {
    			header = element("header");
    			div = element("div");
    			img = element("img");
    			t0 = space();
    			h1 = element("h1");
    			t1 = text(t1_value);
    			t2 = space();
    			span0 = element("span");
    			t3 = text(t3_value);
    			t4 = space();
    			span1 = element("span");
    			t5 = text(t5_value);
    			t6 = space();
    			span2 = element("span");
    			t7 = text(t7_value);
    			t8 = space();
    			span3 = element("span");
    			t9 = text(t9_value);
    			if (img.src !== (img_src_value = url)) attr(img, "src", img_src_value);
    			attr(img, "alt", "ValentinC");
    			attr(img, "class", "svelte-1f8k7dy");
    			attr(h1, "class", "svelte-1f8k7dy");
    			attr(span0, "class", "profession svelte-1f8k7dy");
    			attr(span1, "class", "location svelte-1f8k7dy");
    			attr(span2, "class", "phone svelte-1f8k7dy");
    			attr(span3, "class", "email svelte-1f8k7dy");
    			attr(div, "class", "container svelte-1f8k7dy");
    			attr(header, "class", "svelte-1f8k7dy");
    		},
    		m(target, anchor) {
    			insert(target, header, anchor);
    			append(header, div);
    			append(div, img);
    			append(div, t0);
    			append(div, h1);
    			append(h1, t1);
    			append(div, t2);
    			append(div, span0);
    			append(span0, t3);
    			append(div, t4);
    			append(div, span1);
    			append(span1, t5);
    			append(div, t6);
    			append(div, span2);
    			append(span2, t7);
    			append(div, t8);
    			append(div, span3);
    			append(span3, t9);
    		},
    		p(ctx, [dirty]) {
    			if (dirty & /*details*/ 1 && t1_value !== (t1_value = /*details*/ ctx[0].fullName + "")) set_data(t1, t1_value);
    			if (dirty & /*details*/ 1 && t3_value !== (t3_value = /*details*/ ctx[0].profession + "")) set_data(t3, t3_value);
    			if (dirty & /*details*/ 1 && t5_value !== (t5_value = /*details*/ ctx[0].location + "")) set_data(t5, t5_value);
    			if (dirty & /*details*/ 1 && t7_value !== (t7_value = /*details*/ ctx[0].phone + "")) set_data(t7, t7_value);
    			if (dirty & /*details*/ 1 && t9_value !== (t9_value = /*details*/ ctx[0].email + "")) set_data(t9, t9_value);
    		},
    		i: noop,
    		o: noop,
    		d(detaching) {
    			if (detaching) detach(header);
    		}
    	};
    }

    let url = "./images/profilePic.JPG";

    function instance$3($$self, $$props, $$invalidate) {
    	let data = [];
    	let details = [];

    	onMount(async function () {
    		let response = await fetch("./cv.json");
    		data = await response.json();
    		$$invalidate(0, details = data.details);
    	});

    	return [details];
    }

    class Header extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, instance$3, create_fragment$5, safe_not_equal, {});
    	}
    }

    function typewriter(node, { speed = 30 }) {
    		const valid = (
    			node.childNodes.length === 1 &&
    			node.childNodes[0].nodeType === Node.TEXT_NODE
    		);

    		if (!valid) {
    			throw new Error(`This transition only works on elements with a single text node child`);
    		}

    		const text = node.textContent;
    		const duration = text.length * speed;

    		return {
    			duration,
    			tick: t => {
    				const i = ~~(text.length * t);
    				node.textContent = text.slice(0, i);
    			}
    		};
    	}

    /* src\components\Profile.svelte generated by Svelte v3.37.0 */

    function create_if_block$2(ctx) {
    	let div;
    	let p;
    	let t_value = /*info*/ ctx[2].profile + "";
    	let t;
    	let p_intro;

    	return {
    		c() {
    			div = element("div");
    			p = element("p");
    			t = text(t_value);
    			attr(div, "class", "profile");
    		},
    		m(target, anchor) {
    			insert(target, div, anchor);
    			append(div, p);
    			append(p, t);
    		},
    		p(ctx, dirty) {
    			if (dirty & /*info*/ 4 && t_value !== (t_value = /*info*/ ctx[2].profile + "")) set_data(t, t_value);
    		},
    		i(local) {
    			if (!p_intro) {
    				add_render_callback(() => {
    					p_intro = create_in_transition(p, typewriter, {});
    					p_intro.start();
    				});
    			}
    		},
    		o: noop,
    		d(detaching) {
    			if (detaching) detach(div);
    		}
    	};
    }

    function create_fragment$4(ctx) {
    	let h2;
    	let t0;
    	let t1;
    	let if_block_anchor;
    	let mounted;
    	let dispose;
    	let if_block = /*expanded*/ ctx[0] && create_if_block$2(ctx);

    	return {
    		c() {
    			h2 = element("h2");
    			t0 = text(/*name*/ ctx[1]);
    			t1 = space();
    			if (if_block) if_block.c();
    			if_block_anchor = empty();
    			attr(h2, "class", "svelte-pt2cx7");
    			toggle_class(h2, "expanded", /*expanded*/ ctx[0]);
    		},
    		m(target, anchor) {
    			insert(target, h2, anchor);
    			append(h2, t0);
    			insert(target, t1, anchor);
    			if (if_block) if_block.m(target, anchor);
    			insert(target, if_block_anchor, anchor);

    			if (!mounted) {
    				dispose = listen(h2, "click", /*toggle*/ ctx[3]);
    				mounted = true;
    			}
    		},
    		p(ctx, [dirty]) {
    			if (dirty & /*name*/ 2) set_data(t0, /*name*/ ctx[1]);

    			if (dirty & /*expanded*/ 1) {
    				toggle_class(h2, "expanded", /*expanded*/ ctx[0]);
    			}

    			if (/*expanded*/ ctx[0]) {
    				if (if_block) {
    					if_block.p(ctx, dirty);

    					if (dirty & /*expanded*/ 1) {
    						transition_in(if_block, 1);
    					}
    				} else {
    					if_block = create_if_block$2(ctx);
    					if_block.c();
    					transition_in(if_block, 1);
    					if_block.m(if_block_anchor.parentNode, if_block_anchor);
    				}
    			} else if (if_block) {
    				if_block.d(1);
    				if_block = null;
    			}
    		},
    		i(local) {
    			transition_in(if_block);
    		},
    		o: noop,
    		d(detaching) {
    			if (detaching) detach(h2);
    			if (detaching) detach(t1);
    			if (if_block) if_block.d(detaching);
    			if (detaching) detach(if_block_anchor);
    			mounted = false;
    			dispose();
    		}
    	};
    }

    function instance$2($$self, $$props, $$invalidate) {
    	let { name } = $$props;
    	let { expanded = false } = $$props;

    	function toggle() {
    		$$invalidate(0, expanded = !expanded);
    	}

    	let info = [];

    	onMount(async function () {
    		let response = await fetch("./cv.json");
    		$$invalidate(2, info = await response.json());
    	});

    	$$self.$$set = $$props => {
    		if ("name" in $$props) $$invalidate(1, name = $$props.name);
    		if ("expanded" in $$props) $$invalidate(0, expanded = $$props.expanded);
    	};

    	return [expanded, name, info, toggle];
    }

    class Profile extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, instance$2, create_fragment$4, safe_not_equal, { name: 1, expanded: 0 });
    	}
    }

    /* src\components\Employment.svelte generated by Svelte v3.37.0 */

    function get_each_context$1(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[6] = list[i].job_title;
    	child_ctx[7] = list[i].company_name;
    	child_ctx[8] = list[i].city_name;
    	child_ctx[9] = list[i].employment_period;
    	child_ctx[10] = list[i].task;
    	return child_ctx;
    }

    function get_each_context_1(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[13] = list[i];
    	return child_ctx;
    }

    // (25:0) {#if expanded}
    function create_if_block$1(ctx) {
    	let each_1_anchor;
    	let each_value = /*employment*/ ctx[2];
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block$1(get_each_context$1(ctx, each_value, i));
    	}

    	return {
    		c() {
    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			each_1_anchor = empty();
    		},
    		m(target, anchor) {
    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(target, anchor);
    			}

    			insert(target, each_1_anchor, anchor);
    		},
    		p(ctx, dirty) {
    			if (dirty & /*employment*/ 4) {
    				each_value = /*employment*/ ctx[2];
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context$1(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    						transition_in(each_blocks[i], 1);
    					} else {
    						each_blocks[i] = create_each_block$1(child_ctx);
    						each_blocks[i].c();
    						transition_in(each_blocks[i], 1);
    						each_blocks[i].m(each_1_anchor.parentNode, each_1_anchor);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value.length;
    			}
    		},
    		i(local) {
    			for (let i = 0; i < each_value.length; i += 1) {
    				transition_in(each_blocks[i]);
    			}
    		},
    		o: noop,
    		d(detaching) {
    			destroy_each(each_blocks, detaching);
    			if (detaching) detach(each_1_anchor);
    		}
    	};
    }

    // (32:16) {#each task as item}
    function create_each_block_1(ctx) {
    	let li;
    	let t_value = /*item*/ ctx[13] + "";
    	let t;
    	let li_intro;

    	return {
    		c() {
    			li = element("li");
    			t = text(t_value);
    		},
    		m(target, anchor) {
    			insert(target, li, anchor);
    			append(li, t);
    		},
    		p(ctx, dirty) {
    			if (dirty & /*employment*/ 4 && t_value !== (t_value = /*item*/ ctx[13] + "")) set_data(t, t_value);
    		},
    		i(local) {
    			if (!li_intro) {
    				add_render_callback(() => {
    					li_intro = create_in_transition(li, typewriter, {});
    					li_intro.start();
    				});
    			}
    		},
    		o: noop,
    		d(detaching) {
    			if (detaching) detach(li);
    		}
    	};
    }

    // (26:4) {#each employment as {job_title, company_name, city_name, employment_period, task}}
    function create_each_block$1(ctx) {
    	let div;
    	let h3;
    	let t0_value = /*job_title*/ ctx[6] + "";
    	let t0;
    	let t1;
    	let t2_value = /*company_name*/ ctx[7] + "";
    	let t2;
    	let t3;
    	let t4_value = /*city_name*/ ctx[8] + "";
    	let t4;
    	let t5;
    	let span;
    	let t6_value = /*employment_period*/ ctx[9] + "";
    	let t6;
    	let span_intro;
    	let t7;
    	let p;
    	let p_intro;
    	let t9;
    	let ul;
    	let t10;
    	let each_value_1 = /*task*/ ctx[10];
    	let each_blocks = [];

    	for (let i = 0; i < each_value_1.length; i += 1) {
    		each_blocks[i] = create_each_block_1(get_each_context_1(ctx, each_value_1, i));
    	}

    	return {
    		c() {
    			div = element("div");
    			h3 = element("h3");
    			t0 = text(t0_value);
    			t1 = text(" - ");
    			t2 = text(t2_value);
    			t3 = text(" - ");
    			t4 = text(t4_value);
    			t5 = space();
    			span = element("span");
    			t6 = text(t6_value);
    			t7 = space();
    			p = element("p");
    			p.textContent = "Responsabilities:";
    			t9 = space();
    			ul = element("ul");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			t10 = space();
    			attr(p, "class", "svelte-n6wqjp");
    			attr(ul, "class", "svelte-n6wqjp");
    			attr(div, "class", "profile svelte-n6wqjp");
    		},
    		m(target, anchor) {
    			insert(target, div, anchor);
    			append(div, h3);
    			append(h3, t0);
    			append(h3, t1);
    			append(h3, t2);
    			append(h3, t3);
    			append(h3, t4);
    			append(div, t5);
    			append(div, span);
    			append(span, t6);
    			append(div, t7);
    			append(div, p);
    			append(div, t9);
    			append(div, ul);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(ul, null);
    			}

    			append(div, t10);
    		},
    		p(ctx, dirty) {
    			if (dirty & /*employment*/ 4 && t0_value !== (t0_value = /*job_title*/ ctx[6] + "")) set_data(t0, t0_value);
    			if (dirty & /*employment*/ 4 && t2_value !== (t2_value = /*company_name*/ ctx[7] + "")) set_data(t2, t2_value);
    			if (dirty & /*employment*/ 4 && t4_value !== (t4_value = /*city_name*/ ctx[8] + "")) set_data(t4, t4_value);
    			if (dirty & /*employment*/ 4 && t6_value !== (t6_value = /*employment_period*/ ctx[9] + "")) set_data(t6, t6_value);

    			if (dirty & /*employment*/ 4) {
    				each_value_1 = /*task*/ ctx[10];
    				let i;

    				for (i = 0; i < each_value_1.length; i += 1) {
    					const child_ctx = get_each_context_1(ctx, each_value_1, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    						transition_in(each_blocks[i], 1);
    					} else {
    						each_blocks[i] = create_each_block_1(child_ctx);
    						each_blocks[i].c();
    						transition_in(each_blocks[i], 1);
    						each_blocks[i].m(ul, null);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value_1.length;
    			}
    		},
    		i(local) {
    			if (!span_intro) {
    				add_render_callback(() => {
    					span_intro = create_in_transition(span, typewriter, {});
    					span_intro.start();
    				});
    			}

    			if (!p_intro) {
    				add_render_callback(() => {
    					p_intro = create_in_transition(p, typewriter, {});
    					p_intro.start();
    				});
    			}

    			for (let i = 0; i < each_value_1.length; i += 1) {
    				transition_in(each_blocks[i]);
    			}
    		},
    		o: noop,
    		d(detaching) {
    			if (detaching) detach(div);
    			destroy_each(each_blocks, detaching);
    		}
    	};
    }

    function create_fragment$3(ctx) {
    	let h2;
    	let t0;
    	let t1;
    	let if_block_anchor;
    	let mounted;
    	let dispose;
    	let if_block = /*expanded*/ ctx[0] && create_if_block$1(ctx);

    	return {
    		c() {
    			h2 = element("h2");
    			t0 = text(/*name*/ ctx[1]);
    			t1 = space();
    			if (if_block) if_block.c();
    			if_block_anchor = empty();
    			attr(h2, "class", "svelte-n6wqjp");
    			toggle_class(h2, "expanded", /*expanded*/ ctx[0]);
    		},
    		m(target, anchor) {
    			insert(target, h2, anchor);
    			append(h2, t0);
    			insert(target, t1, anchor);
    			if (if_block) if_block.m(target, anchor);
    			insert(target, if_block_anchor, anchor);

    			if (!mounted) {
    				dispose = listen(h2, "click", /*toggle*/ ctx[3]);
    				mounted = true;
    			}
    		},
    		p(ctx, [dirty]) {
    			if (dirty & /*name*/ 2) set_data(t0, /*name*/ ctx[1]);

    			if (dirty & /*expanded*/ 1) {
    				toggle_class(h2, "expanded", /*expanded*/ ctx[0]);
    			}

    			if (/*expanded*/ ctx[0]) {
    				if (if_block) {
    					if_block.p(ctx, dirty);

    					if (dirty & /*expanded*/ 1) {
    						transition_in(if_block, 1);
    					}
    				} else {
    					if_block = create_if_block$1(ctx);
    					if_block.c();
    					transition_in(if_block, 1);
    					if_block.m(if_block_anchor.parentNode, if_block_anchor);
    				}
    			} else if (if_block) {
    				if_block.d(1);
    				if_block = null;
    			}
    		},
    		i(local) {
    			transition_in(if_block);
    		},
    		o: noop,
    		d(detaching) {
    			if (detaching) detach(h2);
    			if (detaching) detach(t1);
    			if (if_block) if_block.d(detaching);
    			if (detaching) detach(if_block_anchor);
    			mounted = false;
    			dispose();
    		}
    	};
    }

    function instance$1($$self, $$props, $$invalidate) {
    	let { name } = $$props;
    	let { expanded = false } = $$props;
    	let data = [];
    	let employment = [];
    	let tasks = [];

    	function toggle() {
    		$$invalidate(0, expanded = !expanded);
    	}

    	onMount(async function () {
    		let response = await fetch("./cv.json");
    		data = await response.json();
    		$$invalidate(2, employment = data.employment);

    		employment.forEach(e => {
    			tasks.push(e.task);
    		});
    	});

    	$$self.$$set = $$props => {
    		if ("name" in $$props) $$invalidate(1, name = $$props.name);
    		if ("expanded" in $$props) $$invalidate(0, expanded = $$props.expanded);
    	};

    	return [expanded, name, employment, toggle];
    }

    class Employment extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, instance$1, create_fragment$3, safe_not_equal, { name: 1, expanded: 0 });
    	}
    }

    /* src\components\Education.svelte generated by Svelte v3.37.0 */

    function get_each_context(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[5] = list[i];
    	return child_ctx;
    }

    // (21:0) {#if expanded}
    function create_if_block(ctx) {
    	let each_1_anchor;
    	let each_value = /*education*/ ctx[2];
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
    	}

    	return {
    		c() {
    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			each_1_anchor = empty();
    		},
    		m(target, anchor) {
    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(target, anchor);
    			}

    			insert(target, each_1_anchor, anchor);
    		},
    		p(ctx, dirty) {
    			if (dirty & /*education*/ 4) {
    				each_value = /*education*/ ctx[2];
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    						transition_in(each_blocks[i], 1);
    					} else {
    						each_blocks[i] = create_each_block(child_ctx);
    						each_blocks[i].c();
    						transition_in(each_blocks[i], 1);
    						each_blocks[i].m(each_1_anchor.parentNode, each_1_anchor);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value.length;
    			}
    		},
    		i(local) {
    			for (let i = 0; i < each_value.length; i += 1) {
    				transition_in(each_blocks[i]);
    			}
    		},
    		o: noop,
    		d(detaching) {
    			destroy_each(each_blocks, detaching);
    			if (detaching) detach(each_1_anchor);
    		}
    	};
    }

    // (22:1) {#each education as info}
    function create_each_block(ctx) {
    	let div;
    	let h3;
    	let t0_value = /*info*/ ctx[5].school_name + "";
    	let t0;
    	let h3_intro;
    	let t1;
    	let span;
    	let t2_value = /*info*/ ctx[5].period + "";
    	let t2;
    	let span_intro;
    	let t3;

    	return {
    		c() {
    			div = element("div");
    			h3 = element("h3");
    			t0 = text(t0_value);
    			t1 = space();
    			span = element("span");
    			t2 = text(t2_value);
    			t3 = space();
    			attr(div, "class", "profile");
    		},
    		m(target, anchor) {
    			insert(target, div, anchor);
    			append(div, h3);
    			append(h3, t0);
    			append(div, t1);
    			append(div, span);
    			append(span, t2);
    			append(div, t3);
    		},
    		p(ctx, dirty) {
    			if (dirty & /*education*/ 4 && t0_value !== (t0_value = /*info*/ ctx[5].school_name + "")) set_data(t0, t0_value);
    			if (dirty & /*education*/ 4 && t2_value !== (t2_value = /*info*/ ctx[5].period + "")) set_data(t2, t2_value);
    		},
    		i(local) {
    			if (!h3_intro) {
    				add_render_callback(() => {
    					h3_intro = create_in_transition(h3, typewriter, {});
    					h3_intro.start();
    				});
    			}

    			if (!span_intro) {
    				add_render_callback(() => {
    					span_intro = create_in_transition(span, typewriter, {});
    					span_intro.start();
    				});
    			}
    		},
    		o: noop,
    		d(detaching) {
    			if (detaching) detach(div);
    		}
    	};
    }

    function create_fragment$2(ctx) {
    	let h2;
    	let t0;
    	let t1;
    	let if_block_anchor;
    	let mounted;
    	let dispose;
    	let if_block = /*expanded*/ ctx[0] && create_if_block(ctx);

    	return {
    		c() {
    			h2 = element("h2");
    			t0 = text(/*name*/ ctx[1]);
    			t1 = space();
    			if (if_block) if_block.c();
    			if_block_anchor = empty();
    			attr(h2, "class", "svelte-yslexy");
    			toggle_class(h2, "expanded", /*expanded*/ ctx[0]);
    		},
    		m(target, anchor) {
    			insert(target, h2, anchor);
    			append(h2, t0);
    			insert(target, t1, anchor);
    			if (if_block) if_block.m(target, anchor);
    			insert(target, if_block_anchor, anchor);

    			if (!mounted) {
    				dispose = listen(h2, "click", /*toggle*/ ctx[3]);
    				mounted = true;
    			}
    		},
    		p(ctx, [dirty]) {
    			if (dirty & /*name*/ 2) set_data(t0, /*name*/ ctx[1]);

    			if (dirty & /*expanded*/ 1) {
    				toggle_class(h2, "expanded", /*expanded*/ ctx[0]);
    			}

    			if (/*expanded*/ ctx[0]) {
    				if (if_block) {
    					if_block.p(ctx, dirty);

    					if (dirty & /*expanded*/ 1) {
    						transition_in(if_block, 1);
    					}
    				} else {
    					if_block = create_if_block(ctx);
    					if_block.c();
    					transition_in(if_block, 1);
    					if_block.m(if_block_anchor.parentNode, if_block_anchor);
    				}
    			} else if (if_block) {
    				if_block.d(1);
    				if_block = null;
    			}
    		},
    		i(local) {
    			transition_in(if_block);
    		},
    		o: noop,
    		d(detaching) {
    			if (detaching) detach(h2);
    			if (detaching) detach(t1);
    			if (if_block) if_block.d(detaching);
    			if (detaching) detach(if_block_anchor);
    			mounted = false;
    			dispose();
    		}
    	};
    }

    function instance($$self, $$props, $$invalidate) {
    	let { name } = $$props;
    	let { expanded = false } = $$props;
    	let data = [];
    	let education = [];

    	function toggle() {
    		$$invalidate(0, expanded = !expanded);
    	}

    	onMount(async function () {
    		let response = await fetch("./cv.json");
    		data = await response.json();
    		$$invalidate(2, education = data.education);
    	});

    	$$self.$$set = $$props => {
    		if ("name" in $$props) $$invalidate(1, name = $$props.name);
    		if ("expanded" in $$props) $$invalidate(0, expanded = $$props.expanded);
    	};

    	return [expanded, name, education, toggle];
    }

    class Education extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, instance, create_fragment$2, safe_not_equal, { name: 1, expanded: 0 });
    	}
    }

    /* src\components\Footer.svelte generated by Svelte v3.37.0 */

    function create_fragment$1(ctx) {
    	let p;

    	return {
    		c() {
    			p = element("p");
    			p.innerHTML = `Thanks to <a href="https://freeicons.io/profile/2257" target="_blank" class="svelte-1hbn1ue">www.wishforge.games</a>, <a href="https://freeicons.io/profile/714" target="_blank" class="svelte-1hbn1ue">Raj Dev</a>  <a href="https://freeicons.io/profile/3024" target="_blank" class="svelte-1hbn1ue">Tinu CA</a>, <a href="https://freeicons.io/profile/3" target="_blank" class="svelte-1hbn1ue">icon king1</a> for the wonderful free icons shared on <a href="https://freeicons.io" target="_blank" class="svelte-1hbn1ue">freeicons.io</a>`;
    			attr(p, "class", "svelte-1hbn1ue");
    		},
    		m(target, anchor) {
    			insert(target, p, anchor);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d(detaching) {
    			if (detaching) detach(p);
    		}
    	};
    }

    class Footer extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, null, create_fragment$1, safe_not_equal, {});
    	}
    }

    /* src\App.svelte generated by Svelte v3.37.0 */

    function create_fragment(ctx) {
    	let main;
    	let div;
    	let header;
    	let t0;
    	let profile;
    	let t1;
    	let employment;
    	let t2;
    	let education;
    	let t3;
    	let footer1;
    	let footer0;
    	let current;
    	header = new Header({});
    	profile = new Profile({ props: { name: "Profile" } });
    	employment = new Employment({ props: { name: "Employment History" } });
    	education = new Education({ props: { name: "Education" } });
    	footer0 = new Footer({});

    	return {
    		c() {
    			main = element("main");
    			div = element("div");
    			create_component(header.$$.fragment);
    			t0 = space();
    			create_component(profile.$$.fragment);
    			t1 = space();
    			create_component(employment.$$.fragment);
    			t2 = space();
    			create_component(education.$$.fragment);
    			t3 = space();
    			footer1 = element("footer");
    			create_component(footer0.$$.fragment);
    			attr(div, "class", "content svelte-15anlug");
    			attr(main, "class", "svelte-15anlug");
    			attr(footer1, "class", "svelte-15anlug");
    		},
    		m(target, anchor) {
    			insert(target, main, anchor);
    			append(main, div);
    			mount_component(header, div, null);
    			append(div, t0);
    			mount_component(profile, div, null);
    			append(div, t1);
    			mount_component(employment, div, null);
    			append(div, t2);
    			mount_component(education, div, null);
    			insert(target, t3, anchor);
    			insert(target, footer1, anchor);
    			mount_component(footer0, footer1, null);
    			current = true;
    		},
    		p: noop,
    		i(local) {
    			if (current) return;
    			transition_in(header.$$.fragment, local);
    			transition_in(profile.$$.fragment, local);
    			transition_in(employment.$$.fragment, local);
    			transition_in(education.$$.fragment, local);
    			transition_in(footer0.$$.fragment, local);
    			current = true;
    		},
    		o(local) {
    			transition_out(header.$$.fragment, local);
    			transition_out(profile.$$.fragment, local);
    			transition_out(employment.$$.fragment, local);
    			transition_out(education.$$.fragment, local);
    			transition_out(footer0.$$.fragment, local);
    			current = false;
    		},
    		d(detaching) {
    			if (detaching) detach(main);
    			destroy_component(header);
    			destroy_component(profile);
    			destroy_component(employment);
    			destroy_component(education);
    			if (detaching) detach(t3);
    			if (detaching) detach(footer1);
    			destroy_component(footer0);
    		}
    	};
    }

    class App extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, null, create_fragment, safe_not_equal, {});
    	}
    }

    const app = new App({
    	target: document.body
    });

    return app;

}());
//# sourceMappingURL=bundle.js.map
