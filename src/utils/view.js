// Utilities and classes for working with Data Package Views
import { indexOf, find } from "lodash";

/**
 * Convert a view using a simple graph spec to plotly spec for rendering
 * @param {View} view descriptor with compiled in data
 * @return {Object} Plotly spec
 */
export function simpleToPlotly(view) {
  let simpleGraphTypesToPlotly = {
    line: {
      type: 'scatter',
      mode: 'lines',
      line: {
        width: 2,
        shape: 'spline'
      }
    },
    bar: {
      type: 'bar'
    },
    scatter: {
      type: 'scatter'
    }
  };
  let rows = view.resources[0].values;
  let xValues = rows.map(row => row[view.spec.group]);
  // generate the plotly series
  // { 'x': ..., 'y': ..., 'type': ...}
  let data = view.spec.series.map(serie => {
    let out = {
      x: xValues,
      y: rows.map(row => row[serie]),
      name: serie
    }
		Object.assign(out, simpleGraphTypesToPlotly[view.spec.type]);
    return out;
  });

  let plotlySpec = {
    data: data,
    layout: {
      "xaxis": {
        "title": view.spec.group
      }
    }
  }
  return plotlySpec;
}


//Takes data and view, then generates vega-lite specific spec.
export function generateVegaLiteSpec(data, view) {
  let vlSpec = {
    "width": 900,
    "height": 400,
    "data": {"values": []},
    "layers": []
  };
  let headers = data[0];
  vlSpec.data.values = data.slice(1).map(values => {
    return headers.reduce((o, k, i) => {
      o[k] = values[i];
      return o;
    }, {});
  });
  for (let i = 0; i < view.state.series.length; i++) {
    let layer = {
      "mark": "line",
      "encoding": {
        "x": {"field": "", "type": "temporal"},
        "y": {"field": "", "type": "quantitative"}
      }
    };
    layer.encoding.x.field = view.state.group;
    layer.encoding.y.field = view.state.series[i];
    vlSpec.layers.push(layer);
  }
  return vlSpec;
}

// Takes a view spec and resource data (with headers re-inserted) and returns plotly spec
// @return: Plotly graph spec
export function generatePlotlySpec(viewSpec, dataTable) {
  let headers = dataTable[0];
  let rows = dataTable.slice(1);
  let xIndex = indexOf(headers, viewSpec.state.group);
  let xValues = rows.map(row => row[xIndex]);
  let data = viewSpec.state.series.map(serie => {
    let yColumn = indexOf(headers, serie)
    return {
      x: xValues,
      y: rows.map(row => row[yColumn]),
      mode: "lines",
      name: serie
    }
  });

  let plotlySpec = {
    data: data,
    layout: {
      "xaxis": {
        "title": viewSpec.state.group
      }
    }
  }
  return plotlySpec;
}

//Takes a single resource and returns Handsontable spec
export function generateHandsontableSpec(data) {
  return {
    data: data.slice(1), //excluding headers
    colHeaders: data[0], //selecting headers
    readOnly: true,
    width: 1136,
    height: function () {
      if (data.length > 16) {
        return 432;
      }
    },
    colWidths: 47,
    rowWidth: 27,
    stretchH: 'all',
    columnSorting: true,
    search: true
  };
}

// make sure view spec is in "normal" form - i.e. has all the standard fields
// in standard structure atm this just means adding the dataSource field if
// absent
// Changes the viewSpec in place
export function normalizeView(viewSpec) {
  if (!viewSpec.resources) {
    viewSpec.resources = [ 0 ];
  }
}

// convert old Recline "view" to DP View with simple graph spec
export function convertReclineToSimple(reclineViewSpec) {
  let graphTypeConvert = {
    'lines': 'line'
  };
  // TODO: support multiple series
  let out = {
      name: reclineViewSpec.id.toLowerCase(),
      specType: 'simple',
      spec: {
        type: graphTypeConvert[reclineViewSpec.state.graphType],
        group: reclineViewSpec.state.group,
        series: reclineViewSpec.state.series
      }
    };
  return out;
}

/**
 * compile together resources needed for this view based on its data source spec
 * @param {View} view descriptor
 * @param {dataPackage} parent data package - used for resolving the resources
 * @param {dataPackageData} this should be dict keyed by Data Package Name then
      keyed by Resource Name for looking up data
 * @return {Array} An array of resources with their data inlined
 */
export function compileData(view, dataPackage, dataPackageData) {
  let out = view.resources.map(resourceId => {
    let resource = Object.assign({}, findResourceByNameOrIndex(dataPackage, resourceId));
    resource.values = dataPackageData[dataPackage.name][resource.name];
    return resource;
  });
  return out;
}

export function findResourceByNameOrIndex(dp, nameOrIndex) {
  if (typeof(nameOrIndex) == 'number') {
    return dp.resources[nameOrIndex];
  } else {
    return find(dp.resources, (resource) => {return (resource.name == nameOrIndex)});
  }
}


/**
 * Prepare a view for conversion to a renderable spec (normalize it and compile in data)
 * Params as for compileData
 * @return {Object} "compiled" view - normalized and with data inline
 */
export function compileView(inView, dataPackage, dataPackageData) {
  let view = Object.assign({}, inView);
  normalizeView(view);
  let compiledData = compileData(view, dataPackage, dataPackageData);
  view.resources = compiledData;
  return view;
}
