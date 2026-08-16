/**
 * Optimized Image Component
 * Provides lazy loading, placeholder, and error handling for images
 */

import React, { useState, useCallback } from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { MaterialIcons } from '@expo/vector-icons';

const LIGHT_TEXT_TERTIARY = '#9CA3AF';
const LIGHT_BACKGROUND = '#FAF9F6';

export default function OptimizedImage({
  source,
  style,
  placeholder = null,
  contentFit = 'cover',
  transition = 200,
  onLoad,
  onError,
  showPlaceholder = true,
  ...props
}) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const handleLoad = useCallback(() => {
    setIsLoading(false);
    if (onLoad) {
      onLoad();
    }
  }, [onLoad]);

  const handleError = useCallback((error) => {
    setIsLoading(false);
    setHasError(true);
    if (onError) {
      onError(error);
    }
  }, [onError]);

  // If no source or error, show placeholder
  if (!source || hasError) {
    if (!showPlaceholder) return null;
    
    return (
      <View style={[styles.placeholder, style]}>
        {placeholder || (
          <MaterialIcons name="image" size={24} color={LIGHT_TEXT_TERTIARY} />
        )}
      </View>
    );
  }

  return (
    <View style={style}>
      {isLoading && (
        <View style={[StyleSheet.absoluteFill, styles.loadingContainer]}>
          <ActivityIndicator size="small" color={LIGHT_TEXT_TERTIARY} />
        </View>
      )}
      <Image
        source={source}
        style={StyleSheet.absoluteFill}
        contentFit={contentFit}
        transition={transition}
        onLoad={handleLoad}
        onError={handleError}
        cachePolicy="memory-disk"
        {...props}
      />
    </View>
  );
}

/**
 * Thumbnail Image Component
 * Smaller, optimized version for lists
 */
export function ThumbnailImage({
  source,
  style,
  size = 60,
  ...props
}) {
  return (
    <OptimizedImage
      source={source}
      style={[{ width: size, height: size, borderRadius: size / 2 }, style]}
      contentFit="cover"
      {...props}
    />
  );
}

const styles = StyleSheet.create({
  placeholder: {
    backgroundColor: LIGHT_BACKGROUND,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContainer: {
    backgroundColor: LIGHT_BACKGROUND,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
