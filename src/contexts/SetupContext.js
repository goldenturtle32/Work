import React, { createContext, useContext, useState } from 'react';

const SetupContext = createContext();

export const SetupProvider = ({ children }) => {
  const [setupData, setSetupData] = useState({
    // Basic Info
    name: '',
    dateOfBirth: '',
    email: '',
    
    // Location
    location: null,
    locationPreference: 16093.4, // 10 miles in meters default
    cityName: '',
    stateCode: '',
    
    // Job Preferences
    industryPrefs: [],
    selectedJobs: [],
    
    // Overview
    overviewResponses: {},
    generatedOverview: '',
  });

  const updateSetupData = (newData) => {
    setSetupData(prev => ({
      ...prev,
      ...newData
    }));
  };

  return (
    <SetupContext.Provider value={{ setupData, updateSetupData }}>
      {children}
    </SetupContext.Provider>
  );
};

export const useSetup = () => {
  const context = useContext(SetupContext);
  if (!context) {
    throw new Error('useSetup must be used within a SetupProvider');
  }
  return context;
}; 