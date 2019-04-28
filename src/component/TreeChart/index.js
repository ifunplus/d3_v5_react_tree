import React, { Component } from 'react';
import * as d3 from 'd3';
import './index.css';

class TreeChart extends Component {

  constructor(props) {
    super(props)
    
    this.state = {
      jsondata: props.jsondata,
      // 默认整体颜色样式
      preset:props.preset?props.preset:'default',
      // 贝塞尔曲线做连线
      linkShape:props.linkShape?props.linkShape:'diagonal',
      // 渲染树的整体样式
      renderer:props.renderer?props.renderer:'boxed',
    }

    this.printTree = this.printTree.bind(this);
  }

  componentDidMount() {
    this.printTree();
  }

  printTree() {
    // Node-link tree diagram using the Reingold-Tilford "tidy" algorithm,
    // as improved by A.J. van der Ploeg, 2013, "Drawing Non-layered Tidy
    // Trees in Linear Time".
    var d3_flextree = function () {
      var hierarchy = d3_layout_hierarchy().sort(null).value(null);

      // var hierarchy = d3.hierarchy(jsondata, function children(d) {
      //   return d.children;
      // });

      console.log('hierarchy hierarchy',hierarchy)

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
      function tree(d, i) {
        console.log('hierarchy nodes d i',d,i)
        var nodes = hierarchy.call(this, d, i)
        // var nodes = d
        var t = nodes[0]
        var wt = wrapTree(t)

        console.log('hierarchy nodes',nodes)
        console.log('hierarchy nodes t',t ,wt)
        
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
        console.log('我是t',t)
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

    var d3_layout_hierarchy = function() {
      var sort = d3_layout_hierarchySort,
          children = d3_layout_hierarchyChildren,
          value = d3_layout_hierarchyValue;
    
      function hierarchy(root) {
        var stack = [root],
            nodes = [],
            node;
    
        root.depth = 0;
    
        while ((node = stack.pop()) != null) {
          nodes.push(node);
          if ((childs = children.call(hierarchy, node, node.depth)) && (n = childs.length)) {
            var n, childs, child;
            while (--n >= 0) {
              stack.push(child = childs[n]);
              child.parent = node;
              child.depth = node.depth + 1;
            }
            if (value) node.value = 0;
            node.children = childs;
          } else {
            if (value) node.value = +value.call(hierarchy, node, node.depth) || 0;
            delete node.children;
          }
        }
    
        d3_layout_hierarchyVisitAfter(root, function(node) {
          var childs, parent;
          if (sort && (childs = node.children)) childs.sort(sort);
          if (value && (parent = node.parent)) parent.value += node.value;
        });
    
        return nodes;
      }
    
      hierarchy.sort = function(x) {
        if (!arguments.length) return sort;
        sort = x;
        return hierarchy;
      };
    
      hierarchy.children = function(x) {
        if (!arguments.length) return children;
        children = x;
        return hierarchy;
      };
    
      hierarchy.value = function(x) {
        if (!arguments.length) return value;
        value = x;
        return hierarchy;
      };
    
      // Re-evaluates the `value` property for the specified hierarchy.
      hierarchy.revalue = function(root) {
        if (value) {
          d3_layout_hierarchyVisitBefore(root, function(node) {
            if (node.children) node.value = 0;
          });
          d3_layout_hierarchyVisitAfter(root, function(node) {
            var parent;
            if (!node.children) node.value = +value.call(hierarchy, node, node.depth) || 0;
            if (parent = node.parent) parent.value += node.value;
          });
        }
        return root;
      };
    
      return hierarchy;
    };
    
    // A method assignment helper for hierarchy subclasses.
    function d3_layout_hierarchyRebind(object, hierarchy) {
      rebind(object, hierarchy, "sort", "children", "value");
    
      // Add an alias for nodes and links, for convenience.
      object.nodes = object;
      object.links = d3_layout_hierarchyLinks;
    
      return object;
    }
    
    // Pre-order traversal.
    function d3_layout_hierarchyVisitBefore(node, callback) {
      var nodes = [node];
      while ((node = nodes.pop()) != null) {
        callback(node);
        if ((children = node.children) && (n = children.length)) {
          var n, children;
          while (--n >= 0) nodes.push(children[n]);
        }
      }
    }
    
    // Post-order traversal.
    function d3_layout_hierarchyVisitAfter(node, callback) {
      var nodes = [node], nodes2 = [];
      while ((node = nodes.pop()) != null) {
        nodes2.push(node);
        if ((children = node.children) && (n = children.length)) {
          var i = -1, n, children;
          while (++i < n) nodes.push(children[i]);
        }
      }
      while ((node = nodes2.pop()) != null) {
        callback(node);
      }
    }
    
    function d3_layout_hierarchyChildren(d) {
      return d.children;
    }
    
    function d3_layout_hierarchyValue(d) {
      return d.value;
    }
    
    function d3_layout_hierarchySort(a, b) {
      return b.value - a.value;
    }
    
    // Returns an array source+target objects for the specified nodes.
    function d3_layout_hierarchyLinks(nodes) {
      return d3.merge(nodes.map(function(parent) {
        return (parent.children || []).map(function(child) {
          return {source: parent, target: child};
        });
      }));
    }    

    function d3_layout_treeSeparation(a, b) {
      return a.parent == b.parent ? 1 : 2;
    }

    function d3_layout_hierarchyRebind(object, hierarchy) {
      rebind(object, hierarchy, "sort", "children", "value");

      // Add an alias for nodes and links, for convenience.
      object.nodes = object;
      object.links = d3_layout_hierarchyLinks;

      return object;
    }

    //增加rebind源码
    // Copies a variable number of methods from source to target.
var rebind = function(target, source) {
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
      renderer: this.state.renderer,//boxed basic
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
      helperNames: ['layout', 'linkShape', 'color'], //helpers
      layouts: {
        // 创建一个树状图
        tree: function (self) {
          return d3_flextree()
            .setNodeSizes(true)
            .nodeSize(function (d) {
              var width = d.dummy ? self.state.spacingHorizontal : getTextWidth(d.name, self.state.nodeFont);
              if (!d.dummy && width > 0) {
                // Add padding non-empty nodes
                width += 2 * self.state.nodePadding;
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
        {}
        // d3.scale
      ),
      init: function (svg, data, options) {
        options = options || {};
        svg = svg.datum ? svg : d3.select(svg);

        this.helpers = {};
        // layout color linkshape

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
            console.log('d3.event.transform',d3.event)
            this.updateZoom([d3.event.transform.x, d3.event.transform.y], d3.event.transform.k);
          }.bind(this));

        // 添加缩放  
        this.svg = svg
          .call(zoom)
          .append("g");
        console.log('默认树缩放大小',state)
        this.updateZoom(state.zoomTranslate, state.zoomScale);

        // 初始化数据
        this.setData(data);

        this.update(state.root);
        // 更新显示数据 得到边和节点 渲染树

        if (options.autoFit === undefined || options.autoFit === null) {
          state.autoFit = false;
        }
      },
      updateZoom: function (translate, scale) {
        var state = this.state;
        // console.log('state',this.state)
        state.zoomTranslate = translate;
        state.zoomScale = scale;//利用对象的引用特性
        console.log('this.zoom',translate,scale)
        // this.zoom.translate(state.zoomTranslate)
        //   .scale(state.zoomScale);
        this.svg
        .attr("transform", "translate(" + state.zoomTranslate + ")" + " scale(" + state.zoomScale + ")")
      },
      set: function (values) {
        if (values.preset) {
          this.set(this.presets[values.preset]);
        }
        var state = this.state;
        var helpers = this.helpers;
        console.log('state helpers before',state,helpers)
        this.helperNames.forEach(function (h) {
          if (!helpers[h] || (values[h] && values[h] !== state[h])) {
            helpers[h] = this[h + 's'][values[h] || state[h]](this);
          }
        }.bind(this));

        console.log('state helpers after',state,helpers)

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
        console.log('state.root',state.root)
        state.root.x0 = state.height / 2;
        state.root.y0 = 0;

        return this;
      },
      update: function (source) {
        console.log('source',source)
        var state = this.state;
        source = source || state.root;
        // 得到边和节点 links nodes
        var res = this.layout(state);
        console.log('update 得到边和节点',res)
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
          console.log('缩放',translate,scale)
        }

        console.log('渲染 边和节点',source, res.nodes, res.links)

        this.render(source, res.nodes, res.links);
        
        return this;
      },
      layout: function (state) {
        var layout = this.helpers.layout;
        console.log('this.helpers',this.helpers)

        if (state.linkShape !== 'bracket') {
          // Fill in with dummy nodes to handle spacing for layout algorithm
          traverseDummyNodes(state.root);
        }

        // Compute the new tree layout.
        // console.log('layout 计算节点',layout.nodes(state.root),layout.nodes(state.root).reverse())
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

        // console.log('layout 边',links)

        return {
          nodes: nodes,
          links: links
        };
      },
      render: function (source, nodes, links) {
        console.log('this.state.renderer',this.state.renderer)
        this.renderers[this.state.renderer].call(this, source, nodes, links);
      },
      renderers: {
        boxed: function (source, nodes, links) {
          console.log('boxed',source,nodes,links)
          var svg = this.svg;
          console.log('svg',svg.nodes)
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
          console.log('basic')
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
          console.log('basic node before',nodes);
          var node = svg.selectAll("g.markmap-node")
            .data(nodes, function (d) { 
              return d.id || (d.id = ++this.i); }.bind(this));
           console.log('basic node',node);
          // Enter any new nodes at the parent's previous position.
          var nodeEnter = node.enter().append("g")
            .attr("class", "markmap-node")
            .attr("transform", function (d) { 
              console.log('测试transform')
              return "translate(" + (source.y0 + source.y_size - d.y_size) + "," + source.x0 + ")"; })
            .on("click", this.click.bind(this));
            // zhangxue double click

          nodeEnter.append('rect')
            .attr('class', 'markmap-node-rect')
            .attr("y", function (d) { return -linkWidth(d) / 2 })
            .attr('x', function (d) { 
              console.log('rect d.y_size',d.y_size)
              return d.y_size; })
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
            .attr("x", function (d) { 
              console.log('nodeEnter rect d.y_size',d.y_size)
              return d.y_size; })
            .attr("dy", "-5")
            .attr("text-anchor", function (d) { return "start"; })
            //add by zhangxue
            // .attr("fill", "#000")
            // .attr("font", "10px sans-serif")
            .text(function (d) { return d.name; })
            .style("fill-opacity", 1e-6);

          // Transition nodes to their new position.  平移
          console.log("node",node)

          //node报错   svg.selectAll("g.markmap-node")正常
          var nodeUpdate = svg.selectAll("g.markmap-node").transition()
            .duration(state.duration)
            .attr("transform", function (d) { 
              console.log('transition')
              return "translate(" + d.y + "," + d.x + ")"; });

          console.log("nodeUpdate",nodeUpdate)
          nodeUpdate.select('rect')
            .attr('x', -1)
            .attr('width', function (d) { 
              console.log('nodeUpdate rect d.y_size',d.y_size)
              return d.y_size + 2; });

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
          // 和node相同的报错 
          svg.selectAll("path.markmap-link").transition()
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
    Markmap('svg#mindmap', this.state.jsondata, {
      preset: this.state.preset, //default or colorful
      linkShape: this.state.linkShape //diagonal or bracket
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