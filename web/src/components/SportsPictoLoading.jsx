import React, { useState, useEffect } from 'react';

// ランニング、水泳、自転車の出番を増やした新しいリスト
const SPORTS_ICONS = [
  'directions_run',     // 走
  'pool',               // 泳
  'directions_bike',    // 自
  'fitness_center',     // 重
  'directions_run',     // 走
  'pool',               // 泳
  'directions_bike',    // 自
  'rowing',             // ボ
  'directions_run',     // 走
  'pool',               // 泳
  'directions_bike',    // 自
  'accessibility_new'   // 手
];

const SportsPictoLoading = ({ message = "AI抽出を実行中..." }) => {
  const [iconIndex, setIconIndex] = useState(0);

  useEffect(() => {
    // 0.5秒ごとにパキッと切り替える
    const interval = setInterval(() => {
      setIconIndex((prevIndex) => (prevIndex + 1) % SPORTS_ICONS.length);
    }, 500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div style={styles.container}>
      <style>{`
        @keyframes picto-pulse {
          0% { opacity: 0.5; }
          100% { opacity: 1; }
        }
      `}</style>
      
      <div style={styles.iconWrapper}>
        <span className="material-symbols-outlined" style={styles.icon}>
          {SPORTS_ICONS[iconIndex]}
        </span>
      </div>
      <p style={styles.message}>{message}</p>
    </div>
  );
};

// 小さく調整したスタイル
const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '16px', // パディングを半分に (32px -> 16px)
    gap: '8px',     // 間隔を半分に (16px -> 8px)
  },
  iconWrapper: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '60px',  // 小さく (80px -> 60px)
    height: '60px', // 小さく (80px -> 60px)
    borderRadius: '50%',
    backgroundColor: '#f0f9ff',
  },
  icon: {
    fontSize: '36px', // アイコン自体も小さく (48px -> 36px)
    color: '#0284c7',
    opacity: 1,
  },
  message: {
    fontSize: '14px', // テキストを少し小さく (16px -> 14px)
    fontWeight: '600',
    color: '#475569',
    margin: 0,
    animation: 'picto-pulse 1s ease-in-out infinite alternate',
  }
};

export default SportsPictoLoading;
