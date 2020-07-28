/**
 * This file is a copy-paste from https://github.com/rebassjs/grid/blob/master/src/index.js.
 * See https://github.com/opencollective/opencollective/issues/2929 for more info.
 */

import propTypes from '@styled-system/prop-types';
import styled from 'styled-components';
import { border, color, compose, flexbox, grid, layout, space, typography } from 'styled-system';

const boxProps = compose(space, border, color, layout, typography, flexbox);
export const Box = styled('div')(
  {
    boxSizing: 'border-box',
  },
  boxProps,
);

Box.displayName = 'Box';

Box.propTypes = {
  ...propTypes.border,
  ...propTypes.space,
  ...propTypes.color,
  ...propTypes.layout,
  ...propTypes.typography,
  ...propTypes.flexbox,
};

export const Flex = styled(Box)({
  display: 'flex',
});

Flex.displayName = 'Flex';

export const Grid = styled('div')(
  {
    boxSizing: 'border-box',
    display: 'grid',
  },
  compose(space, grid, layout),
);
