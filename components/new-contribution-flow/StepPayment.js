import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { useQuery } from '@apollo/client';
import themeGet from '@styled-system/theme-get';
import { first, get, isEmpty } from 'lodash';
import { defineMessages, useIntl } from 'react-intl';
import styled from 'styled-components';

import { GQLV2_PAYMENT_METHOD_TYPES } from '../../lib/constants/payment-methods';
import { API_V2_CONTEXT, gqlV2 } from '../../lib/graphql/helpers';

import Container from '../../components/Container';
import { Box, Flex } from '../../components/Grid';
import Link from '../../components/Link';
import Loading from '../../components/Loading';
import MessageBox from '../../components/MessageBox';
import NewCreditCardForm from '../../components/NewCreditCardForm';
import StyledRadioList from '../../components/StyledRadioList';
import { P } from '../../components/Text';

import MessageBoxGraphqlError from '../MessageBoxGraphqlError';

import { ERROR_MESSAGES } from './constants';
import { generatePaymentMethodOptions } from './utils';

export const NEW_CREDIT_CARD_KEY = 'newCreditCard';

const PaymentMethodBox = styled(Container)`
  display: flex;
  flex-direction: column;
  background: ${themeGet('colors.white.full')};
  &:hover {
    background: ${themeGet('colors.black.50')};
  }
`;

const paymentMethodsQuery = gqlV2/* GraphQL */ `
  query ContributionFlowPaymentMethods($slug: String) {
    account(slug: $slug) {
      id
      paymentMethods(types: ["creditcard", "virtualcard", "prepaid", "collective"], includeExpired: true) {
        id
        name
        data
        type
        expiryDate
        providerType
        balance {
          valueInCents
          currency
        }
        account {
          id
        }
        limitedToHosts {
          id
          legacyId
          slug
        }
      }
    }
  }
`;

const messages = defineMessages({
  [ERROR_MESSAGES.ERROR_LOW_BALANCE]: {
    id: 'NewContribute.noCollectiveBalance',
    defaultMessage:
      'The balance of this collective is too low to make orders from it. Add funds to {collective} by making a donation to it first.',
  },
  [ERROR_MESSAGES.ERROR_DIFFERENT_HOST]: {
    id: 'NewContribute.noCollectivePaymentMethodsAvailable.differentHost',
    defaultMessage: 'You cannot make donations to the a Collective that has a different fiscal Host.',
  },
  [ERROR_MESSAGES.ERROR_NO_PAYMENT_METHODS]: {
    id: 'NewContribute.noPaymentMethodsAvailable',
    defaultMessage: 'There are no payment methods available.',
  },
});

const formatPaymentMethodError = (intl, collective, error) => {
  if (!messages[error.messageId]) {
    return error.messageId;
  }
  return intl.formatMessage(messages[error.messageId], {
    collective: (
      <Link route="new-donate" params={{ collectiveSlug: collective.slug, verb: 'new-donate' }}>
        {collective.name}
      </Link>
    ),
  });
};

const NewContributionFlowStepPayment = ({
  stepDetails,
  stepProfile,
  stepPayment,
  collective,
  onChange,
  hideCreditCardPostalCode,
}) => {
  const intl = useIntl();
  const [paymentMethodsError, setPaymentMethodsError] = useState(false);

  // GraphQL mutations and queries
  const { loading, data, error } = useQuery(paymentMethodsQuery, {
    variables: { slug: stepProfile.slug },
    context: API_V2_CONTEXT,
    skip: !stepProfile.id,
  });

  // data handling
  const paymentMethods = get(data, 'account.paymentMethods', null) || [];
  const paymentOptions = React.useMemo(() => {
    try {
      return generatePaymentMethodOptions(paymentMethods, stepProfile, stepDetails, collective);
    } catch (error) {
      setPaymentMethodsError({ messageId: error.message });
    }
  }, [paymentMethods, stepProfile, stepDetails, collective]);

  const setNewPaymentMethod = (key, paymentMethod) => {
    if (!paymentMethodsError) {
      onChange({ stepPayment: { key, paymentMethod } });
    }
  };

  // Set default payment method
  useEffect(() => {
    if (!loading && !stepPayment && !isEmpty(paymentOptions)) {
      const firstOption = first(paymentOptions);
      if (firstOption) {
        setNewPaymentMethod(firstOption.key, firstOption.paymentMethod);
      }
    }
  }, [paymentOptions, stepPayment, loading]);

  return (
    <Container width={1} border={['1px solid #DCDEE0', 'none']} borderRadius={15}>
      {loading ? (
        <Loading />
      ) : paymentMethodsError ? (
        <MessageBox type="warning" withIcon>
          {formatPaymentMethodError(intl, collective, paymentMethodsError)}
        </MessageBox>
      ) : error ? (
        <MessageBoxGraphqlError error={error} />
      ) : (
        <StyledRadioList
          id="PaymentMethod"
          name="PaymentMethod"
          keyGetter="key"
          options={paymentOptions}
          onChange={option => setNewPaymentMethod(option.key, option.value.paymentMethod)}
          value={stepPayment?.key || null}
        >
          {({ radio, checked, index, value }) => (
            <PaymentMethodBox
              py={3}
              bg="white.full"
              px={3}
              borderTop={!index ? 'none' : '1px solid'}
              borderColor="black.200"
              cursor={value.disabled ? 'not-allowed' : 'pointer'}
            >
              <Flex alignItems="center" css={value.disabled ? 'filter: grayscale(1) opacity(50%);' : undefined}>
                <Box as="span" mr={3} flexWrap="wrap">
                  {radio}
                </Box>
                <Flex mr={3} css={{ flexBasis: '26px' }}>
                  {value.icon}
                </Flex>
                <Flex flexDirection="column">
                  <P fontSize="15px" lineHeight="20px" fontWeight={400} color="black.900">
                    {value.title}
                  </P>
                  {value.subtitle && (
                    <P fontSize="12px" fontWeight={400} lineHeight="18px" color="black.500">
                      {value.subtitle}
                    </P>
                  )}
                </Flex>
              </Flex>
              {value.key === NEW_CREDIT_CARD_KEY && checked && (
                <Box my={3}>
                  <NewCreditCardForm
                    name={NEW_CREDIT_CARD_KEY}
                    profileType={get(stepProfile, 'type')}
                    hidePostalCode={hideCreditCardPostalCode}
                    onChange={paymentMethod =>
                      setNewPaymentMethod(NEW_CREDIT_CARD_KEY, {
                        ...paymentMethod,
                        type: GQLV2_PAYMENT_METHOD_TYPES.CREDIT_CARD,
                      })
                    }
                  />
                </Box>
              )}
              {value.key === 'manual' && checked && value.instructions && (
                <Box my={3} color="black.600" fontSize="14px">
                  {value.instructions}
                </Box>
              )}
            </PaymentMethodBox>
          )}
        </StyledRadioList>
      )}
    </Container>
  );
};

NewContributionFlowStepPayment.propTypes = {
  collective: PropTypes.object,
  stepDetails: PropTypes.object,
  stepPayment: PropTypes.object,
  stepProfile: PropTypes.object,
  onChange: PropTypes.func,
  loadStripe: PropTypes.func,
  hideCreditCardPostalCode: PropTypes.bool,
};

NewContributionFlowStepPayment.defaultProps = {
  hideCreditCardPostalCode: false,
};

export default NewContributionFlowStepPayment;
