import { Link } from 'react-router-dom';

const NotFound = () => {
  return (
    <div style={{ padding: '80px 20px', textAlign: 'center' }}>
      <h1 style={{ fontSize: '72px', color: '#e5e7eb', margin: 0 }}>404</h1>
      <h2 style={{ color: '#374151', marginTop: '16px' }}>页面不存在</h2>
      <p style={{ color: '#6b7280', marginTop: '8px' }}>您访问的页面可能已被删除或不存在</p>
      <Link
        to="/dashboard"
        style={{
          display: 'inline-block',
          marginTop: '24px',
          padding: '10px 24px',
          backgroundColor: '#3b82f6',
          color: 'white',
          textDecoration: 'none',
          borderRadius: '6px',
          fontSize: '14px',
        }}
      >
        返回首页
      </Link>
    </div>
  );
};

export default NotFound;
