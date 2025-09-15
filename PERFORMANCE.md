# Performance Optimization Guide

## Bundle Analysis

To analyze your bundle size and find optimization opportunities:

```bash
npm run analyze
```

This will build the production version and open the bundle analyzer in your browser.

## Performance Best Practices

### 1. OnPush Change Detection

Consider implementing OnPush change detection strategy for components that don't need frequent updates:

```typescript
@Component({
  selector: 'app-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  // ...
})
export class ExampleComponent {
  // ...
}
```

### 2. TrackBy Functions

For large lists in templates, use trackBy functions:

```typescript
trackByFn(index: number, item: any): any {
  return item.id; // or item if item is a primitive
}
```

### 3. Lazy Loading

Components are already set up for lazy loading. Consider splitting large components further.

### 4. Memory Leaks Prevention

- Always unsubscribe from observables (already implemented in CompareComponent)
- Use `async` pipe when possible
- Avoid creating functions in templates

### 5. Bundle Optimization

- Use Angular's built-in tree shaking
- Consider using Angular's service worker for caching
- Enable gzip compression on your server

## Performance Monitoring

### Build Analysis

```bash
# Check bundle sizes
npm run build:prod

# Analyze bundle composition
npm run analyze
```

### Runtime Performance

Use Chrome DevTools:

1. Performance tab for runtime analysis
2. Memory tab for memory leaks
3. Network tab for loading performance

## Recommendations for This Project

1. **Implement OnPush strategy** for components that primarily display data
2. **Add trackBy functions** for tree tables and lists
3. **Consider virtual scrolling** for large datasets
4. **Implement service worker** for offline functionality
5. **Add loading states** for better UX
6. **Optimize images** and use lazy loading for assets
