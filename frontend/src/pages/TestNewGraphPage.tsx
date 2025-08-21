import React from 'react';
import GraphContainer from '../components/GraphContainer';

const TestNewGraphPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-100">
      <div className="py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-white rounded-lg shadow-lg overflow-hidden">
            <div className="px-6 py-4 bg-gradient-to-r from-blue-600 to-purple-600">
              <h1 className="text-2xl font-bold text-white">
                🔬 Refactored Paper Graph Visualization
              </h1>
              <p className="text-blue-100 mt-1">
                Testing the new modular architecture with enhanced UI
              </p>
            </div>
            <div className="h-[800px]">
              <GraphContainer />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TestNewGraphPage;
