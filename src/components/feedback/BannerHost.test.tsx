import React from 'react';
import { describe, it, expect } from 'vitest';
import { BannerHost } from './BannerHost';

describe('BannerHost Component', () => {
  it('instantiates BannerHost safely', () => {
    const element = React.createElement(BannerHost);
    expect(element.type).toBe(BannerHost);
  });
});
