import React, { Component } from 'react';
import * as d3 from 'd3';
import jsondata from './gtor.json';
import { hierarchy, tree } from 'd3-hierarchy'

class TreeChart extends Component {

  constructor(props) {
    super(props)
    this.state = {
      enableCrosshairs: false,
    }

    // this.printPie = this.printPie.bind(this);
    this.printTree = this.printTree.bind(this);
  }

  componentDidMount() {
    // this.printPie();
    console.log('jsondata', jsondata)
    this.printTree();
  }

  printTree() {
    console.log('printTree')
    // Node-link tree diagram using the Reingold-Tilford "tidy" algorithm,
    // as improved by A.J. van der Ploeg, 2013, "Drawing Non-layered Tidy
    // Trees in Linear Time".
    var d3_layout_flextree = function () {
      // 计算父节点、字节点、高度和深度（parent, children, height, depth）
      // var hierarchy = d3.layout.hierarchy().sort(null).value(null);
      console.log()

      var hierarchy = d3.hierarchy(jsondata);

      var treeLayout = d3.tree();
     
      treeLayout(hierarchy)

      console.log('d3.hierarchy',hierarchy)

      // The spacing between nodes can be specified in one of two ways:
      // - separation - returns center-to-center distance
      //   in units of root-node-x-size
      // - spacing - returns edge-to-edge distance in the same units as
      //   node sizes
      var separation = d3_layout_treeSeparation,
        spacing = null,
        size = [1, 1],    // x_size, y_size
        nodeSize = null,
        setNodeSizes = false;

      // This stores the x_size of the root node, for use with the spacing 
      // function
      var wroot = null;

      // The main layout function:
      function tree(d) {
        console.log('d3.hierarchy call',hierarchy)
        var nodes = d,
          t = nodes[0],
          wt = wrapTree(t);

        console.log('nodes',nodes)

        wroot = wt;
        zerothWalk(wt, 0);
        firstWalk(wt);
        secondWalk(wt, 0);
        renormalize(wt);

        return nodes;
      }

      // Every node in the tree is wrapped in an object that holds data
      // used during the algorithm
      function wrapTree(t) {
        var wt = {
          t: t,
          prelim: 0,
          mod: 0,
          shift: 0,
          change: 0,
          msel: 0,
          mser: 0,
        };
        t.x = 0;
        t.y = 0;
        if (size) {
          wt.x_size = 1;
          wt.y_size = 1;
        }
        else if (typeof nodeSize == "object") {  // fixed array
          wt.x_size = nodeSize[0];
          wt.y_size = nodeSize[1];
        }
        else {  // use nodeSize function
          var ns = nodeSize(t);
          wt.x_size = ns[0];
          wt.y_size = ns[1];
        }
        if (setNodeSizes) {
          t.x_size = wt.x_size;
          t.y_size = wt.y_size;
        }

        var children = [];
        var num_children = t.children ? t.children.length : 0;
        for (var i = 0; i < num_children; ++i) {
          children.push(wrapTree(t.children[i]));
        }
        wt.children = children;
        wt.num_children = num_children;

        return wt;
      }

      // Recursively set the y coordinate of the children, based on
      // the y coordinate of the parent, and its height. Also set parent 
      // and depth.
      function zerothWalk(wt, initial) {
        wt.t.y = initial;
        wt.t.depth = 0;
        _zerothWalk(wt);
      }

      function _zerothWalk(wt) {
        var kid_y = wt.t.y + wt.y_size,
          kid_depth = wt.t.depth + 1,
          i;
        for (i = 0; i < wt.children.length; ++i) {
          var kid = wt.children[i];
          kid.t.y = kid_y;
          kid.t.parent = wt.t;
          kid.t.depth = kid_depth;
          _zerothWalk(wt.children[i]);
        }
      }

      function firstWalk(wt) {
        if (wt.num_children == 0) {
          setExtremes(wt);
          return;
        }
        firstWalk(wt.children[0]);

        var ih = updateIYL(bottom(wt.children[0].el), 0, null);

        for (var i = 1; i < wt.num_children; ++i) {
          firstWalk(wt.children[i]);

          // Store lowest vertical coordinate while extreme nodes still point 
          // in current subtree.
          var minY = bottom(wt.children[i].er);
          separate(wt, i, ih);
          ih = updateIYL(minY, i, ih);
        }
        positionRoot(wt);
        setExtremes(wt);
      }

      function setExtremes(wt) {
        if (wt.num_children == 0) {
          wt.el = wt;
          wt.er = wt;
          wt.msel = wt.mser = 0;
        }
        else {
          wt.el = wt.children[0].el;
          wt.msel = wt.children[0].msel;
          wt.er = wt.children[wt.num_children - 1].er;
          wt.mser = wt.children[wt.num_children - 1].mser;
        }
      }

      function separate(wt, i, ih) {
        // Right contour node of left siblings and its sum of modifiers.  
        var sr = wt.children[i - 1];
        var mssr = sr.mod;

        // Left contour node of current subtree and its sum of modifiers.  
        var cl = wt.children[i];
        var mscl = cl.mod;

        while (sr != null && cl != null) {
          if (bottom(sr) > ih.lowY) ih = ih.nxt;

          // How far to the left of the right side of sr is the left side 
          // of cl? First compute the center-to-center distance, then add 
          // the "gap" (separation or spacing)
          var dist = (mssr + sr.prelim) - (mscl + cl.prelim);
          if (separation != null) {
            dist += separation(sr.t, cl.t) * wroot.x_size;
          }
          else if (spacing != null) {
            dist += sr.x_size / 2 + cl.x_size / 2 + spacing(sr.t, cl.t);
          }
          if (dist > 0) {
            mscl += dist;
            moveSubtree(wt, i, ih.index, dist);
          }

          // Fix for layout bug, https://github.com/Klortho/d3-flextree/issues/1,
          // HT @lianyi
          else if (i === 1 && mscl === 0 &&
            sr.num_children === 0 && cl.num_children > 1 && dist < 0) {
            mscl += dist;
            moveSubtree(wt, i, ih.index, dist);
          }

          var sy = bottom(sr),
            cy = bottom(cl);

          // Advance highest node(s) and sum(s) of modifiers  
          if (sy <= cy) {
            sr = nextRightContour(sr);
            if (sr != null) mssr += sr.mod;
          }
          if (sy >= cy) {
            cl = nextLeftContour(cl);
            if (cl != null) mscl += cl.mod;
          }
        }

        // Set threads and update extreme nodes. In the first case, the 
        // current subtree must be taller than the left siblings.  
        if (sr == null && cl != null) setLeftThread(wt, i, cl, mscl);

        // In this case, the left siblings must be taller than the current 
        // subtree.  
        else if (sr != null && cl == null) setRightThread(wt, i, sr, mssr);
      }

      function moveSubtree(wt, i, si, dist) {
        // Move subtree by changing mod.  
        wt.children[i].mod += dist;
        wt.children[i].msel += dist;
        wt.children[i].mser += dist;
        distributeExtra(wt, i, si, dist);
      }

      function nextLeftContour(wt) {
        return wt.num_children == 0 ? wt.tl : wt.children[0];
      }

      function nextRightContour(wt) {
        return wt.num_children == 0 ?
          wt.tr : wt.children[wt.num_children - 1];
      }

      function bottom(wt) {
        return wt.t.y + wt.y_size;
      }

      function setLeftThread(wt, i, cl, modsumcl) {
        var li = wt.children[0].el;
        li.tl = cl;

        // Change mod so that the sum of modifier after following thread 
        // is correct.  
        var diff = (modsumcl - cl.mod) - wt.children[0].msel;
        li.mod += diff;

        // Change preliminary x coordinate so that the node does not move.  
        li.prelim -= diff;

        // Update extreme node and its sum of modifiers.  
        wt.children[0].el = wt.children[i].el;
        wt.children[0].msel = wt.children[i].msel;
      }

      // Symmetrical to setLeftThread.  
      function setRightThread(wt, i, sr, modsumsr) {
        var ri = wt.children[i].er;
        ri.tr = sr;
        var diff = (modsumsr - sr.mod) - wt.children[i].mser;
        ri.mod += diff;
        ri.prelim -= diff;
        wt.children[i].er = wt.children[i - 1].er;
        wt.children[i].mser = wt.children[i - 1].mser;
      }

      // Position root between children, taking into account their mod.  
      function positionRoot(wt) {
        wt.prelim = (wt.children[0].prelim +
          wt.children[0].mod -
          wt.children[0].x_size / 2 +
          wt.children[wt.num_children - 1].mod +
          wt.children[wt.num_children - 1].prelim +
          wt.children[wt.num_children - 1].x_size / 2) / 2;
      }

      function secondWalk(wt, modsum) {
        modsum += wt.mod;
        // Set absolute (non-relative) horizontal coordinate.  
        wt.t.x = wt.prelim + modsum;
        addChildSpacing(wt);
        for (var i = 0; i < wt.num_children; i++)
          secondWalk(wt.children[i], modsum);
      }

      function distributeExtra(wt, i, si, dist) {
        // Are there intermediate children?
        if (si != i - 1) {
          var nr = i - si;
          wt.children[si + 1].shift += dist / nr;
          wt.children[i].shift -= dist / nr;
          wt.children[i].change -= dist - dist / nr;
        }
      }

      // Process change and shift to add intermediate spacing to mod.  
      function addChildSpacing(wt) {
        var d = 0, modsumdelta = 0;
        for (var i = 0; i < wt.num_children; i++) {
          d += wt.children[i].shift;
          modsumdelta += d + wt.children[i].change;
          wt.children[i].mod += modsumdelta;
        }
      }

      // Make/maintain a linked list of the indexes of left siblings and their 
      // lowest vertical coordinate.  
      function updateIYL(minY, i, ih) {
        // Remove siblings that are hidden by the new subtree.  
        while (ih != null && minY >= ih.lowY) ih = ih.nxt;
        // Prepend the new subtree.  
        return {
          lowY: minY,
          index: i,
          nxt: ih,
        };
      }

      // Renormalize the coordinates
      function renormalize(wt) {

        // If a fixed tree size is specified, scale x and y based on the extent.
        // Compute the left-most, right-most, and depth-most nodes for extents.
        if (size != null) {
          var left = wt,
            right = wt,
            bottom = wt;
          var toVisit = [wt],
            node;
          while (node = toVisit.pop()) {
            var t = node.t;
            if (t.x < left.t.x) left = node;
            if (t.x > right.t.x) right = node;
            if (t.depth > bottom.t.depth) bottom = node;
            if (node.children)
              toVisit = toVisit.concat(node.children);
          }

          var sep = separation == null ? 0.5 : separation(left.t, right.t) / 2;
          var tx = sep - left.t.x;
          var kx = size[0] / (right.t.x + sep + tx);
          var ky = size[1] / (bottom.t.depth > 0 ? bottom.t.depth : 1);

          toVisit = [wt];
          while (node = toVisit.pop()) {
            var t = node.t;
            t.x = (t.x + tx) * kx;
            t.y = t.depth * ky;
            if (setNodeSizes) {
              t.x_size *= kx;
              t.y_size *= ky;
            }
            if (node.children)
              toVisit = toVisit.concat(node.children);
          }
        }

        // Else either a fixed node size, or node size function was specified.
        // In this case, we translate such that the root node is at x = 0.
        else {
          var rootX = wt.t.x;
          moveRight(wt, -rootX);
        }
      }

      function moveRight(wt, move) {
        wt.t.x += move;
        for (var i = 0; i < wt.num_children; ++i) {
          moveRight(wt.children[i], move);
        }
      }

      // Setter and getter methods

      tree.separation = function (x) {
        if (!arguments.length) return separation;
        separation = x;
        spacing = null;
        return tree;
      };

      tree.spacing = function (x) {
        if (!arguments.length) return spacing;
        spacing = x;
        separation = null;
        return tree;
      }

      tree.size = function (x) {
        if (!arguments.length) return size;
        size = x;
        nodeSize = null;
        return tree;
      };

      tree.nodeSize = function (x) {
        if (!arguments.length) return nodeSize;
        nodeSize = x;
        size = null;
        return tree;
      };

      tree.setNodeSizes = function (x) {
        if (!arguments.length) return setNodeSizes;
        setNodeSizes = x;
        return tree;
      };

      tree.rootXSize = function () {
        return wroot ? wroot.x_size : null;
      }

      return d3_layout_hierarchyRebind(tree, hierarchy);
    };

    function d3_layout_treeSeparation(a, b) {
      return a.parent == b.parent ? 1 : 2;
    }

    function d3_layout_hierarchyRebind(object, hierarchy) {
      // d3.rebind(object, hierarchy, "sort", "children", "value");
      // 参考 https://stackoverflow.com/questions/47844765/d3-rebind-in-d3-v4
      d3Rebind(object, hierarchy, "sort", "children", "value");
      // Add an alias for nodes and links, for convenience.
      object.nodes = object;
      object.links = d3_layout_hierarchyLinks;

      return object;
    }

    // Copies a variable number of methods from source to target.
var d3Rebind = function(target, source) {
  var i = 1, n = arguments.length, method;
  while (++i < n) target[method = arguments[i]] = d3_rebind(target, source, source[method]);
  return target;
};

// Method is assumed to be a standard D3 getter-setter:
// If passed with no arguments, gets the value.
// If passed with arguments, sets the value and returns the target.
function d3_rebind(target, source, method) {
  return function() {
    var value = method.apply(source, arguments);
    return value === source ? target : value;
  };
}

    function d3_layout_hierarchyLinks(nodes) {
      return d3.merge(nodes.map(function (parent) {
        return (parent.children || []).map(function (child) {
          return { source: parent, target: child };
        });
      }));
    }

    var assign = Object.assign || function (dst, src) {
      // poor man's Object.assign()
      for (var k in src) {
        if (src.hasOwnProperty(k)) {
          dst[k] = src[k];
        }
      }
      return dst;
    };

    function getTextWidth(text, font) {
      // re-use canvas object for better performance
      // console.log('getTextWidth',text,font)
      var canvas = getTextWidth.canvas || (getTextWidth.canvas = document.createElement("canvas"));
      var context = canvas.getContext("2d");
      context.font = font;
      var metrics = context.measureText(text);
      return metrics.width;
    }

    function traverseBranchId(node, branch, state) {
      node.branch = branch;
      if (node.children) {
        node.children.forEach(function (d) {
          traverseBranchId(d, branch, state);
        });
      }
    }

    function traverseDummyNodes(node) {
      if (node.children) {
        node.children.forEach(traverseDummyNodes);

        node.children = [{
          name: '',
          dummy: true,
          children: node.children
        }];
      }
    }

    function traverseTruncateLabels(node, length) {
      if (node.name.length > length) {
        node.name = node.name.slice(0, length - 1) + '\u2026';
      }
      if (node.children) {
        node.children.forEach(function (n) {
          traverseTruncateLabels(n, length);
        });
      }
    }

    function Markmap(svg, data, options) {
      if (!(this instanceof Markmap)) return new Markmap(svg, data, options);
      this.init(svg, data, options);
    }

    var defaultPreset = {
      nodeHeight: 20,
      nodeWidth: 180,
      nodePadding: 12,
      spacingVertical: 5,
      spacingHorizontal: 60,
      truncateLabels: 0,
      duration: 750,
      layout: 'tree',
      color: 'gray',
      linkShape: 'diagonal',
      renderer: 'boxed'
    };

    assign(Markmap.prototype, {
      getInitialState: function () {
        return {
          zoomScale: 1,
          zoomTranslate: [0, 0],
          autoFit: true,
          depthMaxSize: {},
          yByDepth: {},
          nodeFont: '10px sans-serif'
        };
      },
      presets: {
        'default': defaultPreset,
        'colorful': assign(assign({}, defaultPreset), {
          nodeHeight: 10,
          renderer: 'basic',
          color: 'category20',
          nodePadding: 6
        })
      },
      helperNames: ['layout', 'linkShape', 'color'],
      layouts: {
        tree: function (self) {
          return d3_layout_flextree()
            .setNodeSizes(true)
            .nodeSize(function (d) {
              var width = d.dummy ? self.state.spacingHorizontal : getTextWidth(d.name, self.state.nodeFont);
              if (!d.dummy && width > 0) {
                // Add padding non-empty nodes
                width += 2 * self.state.nodePadding;
                // console.log('node width',d.name,width,self.state.nodeFont)
              }
              return [self.state.nodeHeight, width];
            })
            .spacing(function (a, b) {
              return a.parent == b.parent ? self.state.spacingVertical : self.state.spacingVertical * 2;
            })
        }
      },
      linkShapes: {
        diagonal: function () {
          return function diagonal(d) {
            return "M" + d.source.y + "," + d.source.x
              + "C" + (d.source.y + d.target.y) / 2 + "," + d.source.x
              + " " + (d.source.y + d.target.y) / 2 + "," + d.target.x
              + " " + d.target.y + "," + d.target.x;
          };
        },
        bracket: function () {
          return function (d) {
            return "M" + d.source.y + "," + d.source.x
              + "V" + d.target.x + "H" + d.target.y;
          };
        }
      },
      colors: assign(
        { gray: function () { return function () { return '#929292'; } } },
        // d3.scale
      ),
      init: function (svg, data, options) {
        options = options || {};

        svg = svg.datum ? svg : d3.select(svg);

        this.helpers = {};
        this.i = 0;
        var state = this.state = this.getInitialState();
        this.set(this.presets[options.preset || 'default']);
        state.height = svg.node().getBoundingClientRect().height;
        state.width = svg.node().getBoundingClientRect().width;
        this.set(options);

        // disable panning using right mouse button
        svg.on("mousedown", function () {
          var ev = d3.event;
          if (ev.button === 2) {
            ev.stopImmediatePropagation();
          }
        });

        var zoom = this.zoom = d3.zoom()
          .on("zoom", function () {
            this.updateZoom(d3.event.translate, d3.event.scale);
          }.bind(this));

        this.svg = svg
          .call(zoom)
          .append("g");

        this.updateZoom(state.zoomTranslate, state.zoomScale);

        this.setData(data);
        this.update(state.root);

        if (options.autoFit === undefined || options.autoFit === null) {
          state.autoFit = false;
        }
      },
      updateZoom: function (translate, scale) {
        var state = this.state;
        state.zoomTranslate = translate;
        state.zoomScale = scale;
        
        // this.zoom.translateBy (state.zoomTranslate)
        //   .scaleBy(state.zoomScale);
        this.svg.attr("transform", "translate(" + state.zoomTranslate + ")" + " scale(" + state.zoomScale + ")")

        // this.zoom.translateExtent(state.zoomTranslate )
        //   .scaleExtent(state.zoomScale);
          

        
      },
      set: function (values) {
        if (values.preset) {
          this.set(this.presets[values.preset]);
        }
        var state = this.state;
        var helpers = this.helpers;
        this.helperNames.forEach(function (h) {
          if (!helpers[h] || (values[h] && values[h] !== state[h])) {
            helpers[h] = this[h + 's'][values[h] || state[h]](this);
          }
        }.bind(this));
        assign(state, values || {});
        return this;
      },
      setData: function (data) {
        var state = this.state;

        if (state.truncateLabels) {
          traverseTruncateLabels(data, state.truncateLabels);
        }

        if (data.children) {
          data.children.forEach(function (d, i) {
            traverseBranchId(d, i, state);
          });
        }

        var state = this.state;
        state.root = data;
        state.root.x0 = state.height / 2;
        state.root.y0 = 0;

        return this;
      },
      update: function (source) {
        var state = this.state;
        source = source || state.root;
        var res = this.layout(state);
        if (state.autoFit) {
          var minX = d3.min(res.nodes, function (d) { return d.x; });
          var minY = d3.min(res.nodes, function (d) { return d.y; });
          var maxX = d3.max(res.nodes, function (d) { return d.x; });
          var maxY = d3.max(res.nodes, function (d) { return d.y + d.y_size; });
          var realHeight = maxX - minX;
          var realWidth = maxY - minY;
          var scale = Math.min(state.height / realHeight, state.width / realWidth, 1);
          var translate = [
            (state.width - realWidth * scale) / 2 - minY * scale,
            (state.height - realHeight * scale) / 2 - minX * scale
          ];
          this.updateZoom(translate, scale);
        }
        this.render(source, res.nodes, res.links);
        return this;
      },
      layout: function (state) {
        var layout = this.helpers.layout;

        if (state.linkShape !== 'bracket') {
          // Fill in with dummy nodes to handle spacing for layout algorithm
          traverseDummyNodes(state.root);
        }

        // Compute the new tree layout.
        var nodes = layout.nodes(state.root).reverse();

        // Remove dummy nodes after layout is computed
        nodes = nodes.filter(function (n) { return !n.dummy; });
        nodes.forEach(function (n) {
          if (n.children && n.children.length === 1 && n.children[0].dummy) {
            n.children = n.children[0].children;
          }
          if (n.parent && n.parent.dummy) {
            n.parent = n.parent.parent;
          }
        });

        if (state.linkShape === 'bracket') {
          nodes.forEach(function (n) {
            n.y += n.depth * state.spacingHorizontal;
          });
        }

        var links = layout.links(nodes);

        return {
          nodes: nodes,
          links: links
        };
      },
      render: function (source, nodes, links) {
        this.renderers[this.state.renderer].call(this, source, nodes, links);
      },
      renderers: {
        boxed: function (source, nodes, links) {
          var svg = this.svg;
          var state = this.state;
          var color = this.helpers.color;
          this.renderers.basic.call(this, source, nodes, links);
          var node = svg.selectAll("g.markmap-node");

          node.select('rect')
            .attr("y", -state.nodeHeight / 2)
            .attr('rx', 10)
            .attr('ry', 10)
            .attr('height', state.nodeHeight)
            .attr('fill', function (d) { return d3.rgb(color(d.branch)).brighter(1.2); })
            .attr('stroke', function (d) { return color(d.branch); })
            .attr('stroke-width', 1);

          node.select('text')
            .attr("dy", "3")

          svg.selectAll("path.markmap-link")
            .attr('stroke-width', 1);
        },
        basic: function (source, nodes, links) {
          var svg = this.svg;
          var state = this.state;
          var color = this.helpers.color;
          var linkShape = this.helpers.linkShape;

          function linkWidth(d) {
            var depth = d.depth;
            if (d.name !== '' && d.children && d.children.length === 1 && d.children[0].name === '') {
              depth += 1;
            }
            return Math.max(6 - 2 * depth, 1.5);
          }

          // Update the nodes…
          var node = svg.selectAll("g.markmap-node")
            .data(nodes, function (d) { return d.id || (d.id = ++this.i); }.bind(this));

          // Enter any new nodes at the parent's previous position.
          var nodeEnter = node.enter().append("g")
            .attr("class", "markmap-node")
            .attr("transform", function (d) { return "translate(" + (source.y0 + source.y_size - d.y_size) + "," + source.x0 + ")"; })
            .on("click", this.click.bind(this));

          nodeEnter.append('rect')
            .attr('class', 'markmap-node-rect')
            .attr("y", function (d) { return -linkWidth(d) / 2 })
            .attr('x', function (d) { return d.y_size; })
            .attr('width', 0)
            .attr('height', linkWidth)
            .attr('fill', function (d) { return color(d.branch); });

          nodeEnter.append("circle")
            .attr('class', 'markmap-node-circle')
            .attr('cx', function (d) { return d.y_size; })
            .attr('stroke', function (d) { return color(d.branch); })
            .attr("r", 1e-6)
            // .style("fill", function (d) { return d._children ? color(d.branch) : ''; });
            .attr('fill','#fff')
            .attr('stroke-width',1.5);

          nodeEnter.append("text")
            .attr('class', 'markmap-node-text')
            .attr("x", function (d) { return d.y_size; })
            .attr("dy", "-5")
            .attr("text-anchor", function (d) { return "start"; })
            //add by zhangxue
            .attr("fill", "#000")
            .attr("font", "10px sans-serif")
            .text(function (d) { return d.name; })
            .style("fill-opacity", 1e-6);

          // Transition nodes to their new position.
          var nodeUpdate = node.transition()
            .duration(state.duration)
            .attr("transform", function (d) { return "translate(" + d.y + "," + d.x + ")"; });

          nodeUpdate.select('rect')
            .attr('x', -1)
            .attr('width', function (d) { return d.y_size + 2; });

          nodeUpdate.select("circle")
            .attr("r", 4.5)
            .style("fill", function (d) { return d._children ? color(d.branch) : ''; })
            .style('display', function (d) {
              var hasChildren = d.children || d._children;
              return hasChildren ? 'inline' : 'none';
            });

          nodeUpdate.select("text")
            .attr("x", 10)
            .style("fill-opacity", 1);

          // Transition exiting nodes to the parent's new position.
          var nodeExit = node.exit().transition()
            .duration(state.duration)
            .attr("transform", function (d) { return "translate(" + (source.y + source.y_size - d.y_size) + "," + source.x + ")"; })
            .remove();

          nodeExit.select('rect')
            .attr('x', function (d) { return d.y_size; })
            .attr('width', 0);

          nodeExit.select("circle")
            .attr("r", 1e-6);

          nodeExit.select("text")
            .style("fill-opacity", 1e-6)
            .attr("x", function (d) { return d.y_size; });


          // Update the links…
          var link = svg.selectAll("path.markmap-link")
            .data(links, function (d) { return d.target.id; });

          // Enter any new links at the parent's previous position.
          link.enter().insert("path", "g")
            .attr("class", "markmap-link")
            .attr('stroke', function (d) { return color(d.target.branch); })
            .attr('stroke-width', function (l) { return linkWidth(l.target); })
            .attr("d", function (d) {
              var o = { x: source.x0, y: source.y0 + source.y_size };
              return linkShape({ source: o, target: o });
            })
            .attr('fill', 'none')
            ;

          // Transition links to their new position.
          link.transition()
            .duration(state.duration)
            .attr("d", function (d) {
              var s = { x: d.source.x, y: d.source.y + d.source.y_size };
              var t = { x: d.target.x, y: d.target.y };
              return linkShape({ source: s, target: t });
            });

          // Transition exiting nodes to the parent's new position.
          link.exit().transition()
            .duration(state.duration)
            .attr("d", function (d) {
              var o = { x: source.x, y: source.y + source.y_size };
              return linkShape({ source: o, target: o });
            })
            .remove();

          // Stash the old positions for transition.
          nodes.forEach(function (d) {
            d.x0 = d.x;
            d.y0 = d.y;
          });
        }
      },
      // Toggle children on click.
      click: function (d) {
        if (d.children) {
          d._children = d.children;
          d.children = null;
        } else {
          d.children = d._children;
          d._children = null;
        }
        this.update(d);
      }

    });

    // return Markmap;
    Markmap('svg#mindmap', jsondata, {
      preset: 'default', // or colorful
      linkShape: 'diagonal' // or bracket
    });

  }

  render() {

    return (
      <div style={{ height: "1000px", width: "100%" }}>
        <svg id="mindmap"></svg>
      </div>
    );
  }

}

export default TreeChart;