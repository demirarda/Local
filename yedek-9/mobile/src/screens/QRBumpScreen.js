import React, { useEffect } from 'react';
import QRBumpSheet from '../components/QRBumpSheet';

/** Navigation fallback — spec prefers sheet; route opens the same sheet UI. */
export default function QRBumpScreen({ navigation }) {
  useEffect(() => {
    // Sheet is always visible while this route is mounted.
  }, []);

  return (
    <QRBumpSheet
      visible
      onClose={() => {
        if (navigation.canGoBack()) navigation.goBack();
      }}
    />
  );
}
