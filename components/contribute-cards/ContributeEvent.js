import React from 'react';
import PropTypes from 'prop-types';
import { FormattedMessage } from 'react-intl';
import { truncate } from 'lodash';

import { ContributionTypes } from '../../lib/constants/contribution-types';
import { canOrderTicketsFromEvent } from '../../lib/events';
import { Span } from '../Text';
import Link from '../Link';
import Contribute from './Contribute';

const ContributeEvent = ({ collective, event, ...props }) => {
  let description = null;
  if (event.description) {
    description = `${truncate(event.description, { length: 256 })} `;
  }

  return (
    <Contribute
      route="event"
      routeParams={{ parentCollectiveSlug: collective.slug, eventSlug: event.slug }}
      type={ContributionTypes.EVENT_PARTICIPATE}
      title={event.name}
      contributors={event.contributors}
      stats={event.stats.backers}
      withoutCTA={!canOrderTicketsFromEvent(event)}
      {...props}
    >
      {description}
      <Link route="event" params={{ parentCollectiveSlug: collective.slug, eventSlug: event.slug }}>
        <Span textTransform="capitalize" whiteSpace="nowrap">
          <FormattedMessage id="ContributeCard.ReadMore" defaultMessage="Read more" />
        </Span>
      </Link>
    </Contribute>
  );
};

ContributeEvent.propTypes = {
  collective: PropTypes.shape({
    slug: PropTypes.string.isRequired,
  }),
  event: PropTypes.shape({
    id: PropTypes.number.isRequired,
    name: PropTypes.string.isRequired,
    slug: PropTypes.string.isRequired,
    startsAt: PropTypes.string,
    endsAt: PropTypes.string,
    description: PropTypes.string,
    contributors: PropTypes.arrayOf(PropTypes.object),
    stats: PropTypes.shape({
      backers: PropTypes.object,
    }).isRequired,
  }),
};

export default ContributeEvent;