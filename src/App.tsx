import { ComtradeChart } from './components/ComtradeChart';
import { parseComtrade } from './utils/comtradeParser';
import cfgText from './samples/ieee13_pv_l1c1b1f1.cfg?raw';
import datText from './samples/ieee13_pv_l1c1b1f1.dat?raw';
import './App.css';

const comtradeData = parseComtrade(cfgText, datText);

function App() {
  return (
    <main className="chart-page">
      <ComtradeChart data={comtradeData} />
    </main>
  );
}

export default App;
