import React, { Component } from 'react';
import './App.css';
import TreeChart from './component/TreeChart'
import jsondata from './gtor.json';

class App extends Component {
  state = {
    data: [12, 5, 6, 6, 9, 10],
    width: 1000,
    height: 700,
  }

  render() {
    return (
      <div id="chartDiv">
        {/* <BarChart data={this.state.data} width={this.state.width} height={this.state.height} /> */}
        <TreeChart jsondata={jsondata}/>
      </div>
    );
  }
}

export default App;