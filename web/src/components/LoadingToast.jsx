import React from 'react';
import SportsPictoLoading from './SportsPictoLoading';

const LoadingToast = ({ message, show }) => {
    if (!show)
        return null;
    return (<div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 px-8 py-6 rounded-lg shadow-2xl z-[9999] bg-white border-2 border-blue-500" style={{
            minWidth: '400px',
            maxWidth: '600px',
        }}>
      <div className="flex flex-col items-center space-y-4">
        <SportsPictoLoading message={message} />
      </div>
    </div>);
};
export default LoadingToast;
