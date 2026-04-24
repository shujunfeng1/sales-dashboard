import { useEffect } from 'react';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { Dashboard } from './components/Dashboard';
import { initStorage } from './stores/useDataStore';
import './App.css';

function App() {
  useEffect(() => {
    initStorage();
  }, []);

  return (
    <ConfigProvider locale={zhCN}>
      <Dashboard />
    </ConfigProvider>
  );
}

export default App;
