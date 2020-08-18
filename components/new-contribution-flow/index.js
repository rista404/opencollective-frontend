import React from 'react';
import PropTypes from 'prop-types';
import { graphql } from '@apollo/client/react/hoc';
import { get, pick } from 'lodash';
import memoizeOne from 'memoize-one';
import { defineMessages, injectIntl } from 'react-intl';
import styled from 'styled-components';

import { CollectiveType } from '../../lib/constants/collectives';
import { getGQLV2FrequencyFromInterval } from '../../lib/constants/intervals';
import { TierTypes } from '../../lib/constants/tiers-types';
import { API_V2_CONTEXT, gqlV2 } from '../../lib/graphql/helpers';
import { getDefaultTierAmount, getTierMinAmount, isFixedContribution } from '../../lib/tier-utils';
import { getWebsiteUrl } from '../../lib/utils';
import { Router } from '../../server/pages';

import Container from '../../components/Container';
import NewContributeFAQ from '../../components/faqs/NewContributeFAQ';
import { Box, Grid } from '../../components/Grid';
import { addSignupMutation } from '../../components/SignInOrJoinFree';

import Loading from '../Loading';
import Steps from '../Steps';
import { withUser } from '../UserProvider';

import NewContributionFlowButtons from './ContributionFlowButtons';
import ContributionFlowHeader from './ContributionFlowHeader';
import ContributionFlowMainContainer from './ContributionFlowMainContainer';
import ContributionFlowStepsProgress from './ContributionFlowStepsProgress';
import SafeTransactionMessage from './SafeTransactionMessage';
import { taxesMayApply } from './utils';

const StepsProgressBox = styled(Box)`
  min-height: 115px;
  max-width: 450px;

  @media screen and (max-width: 640px) {
    width: 100%;
    max-width: 100%;
  }
`;

const stepsLabels = defineMessages({
  contributeAs: {
    id: 'contribute.step.contributeAs',
    defaultMessage: 'Contribute as',
  },
  details: {
    id: 'contribute.step.details',
    defaultMessage: 'Details',
  },
  payment: {
    id: 'contribute.step.payment',
    defaultMessage: 'Payment info',
  },
  summary: {
    id: 'contribute.step.summary',
    defaultMessage: 'Summary',
  },
});

class ContributionFlow extends React.Component {
  static propTypes = {
    collective: PropTypes.shape({
      slug: PropTypes.string.isRequired,
      currency: PropTypes.string.isRequired,
      platformContributionAvailable: PropTypes.bool,
      parentCollective: PropTypes.shape({
        slug: PropTypes.string,
      }),
    }).isRequired,
    host: PropTypes.object.isRequired,
    tier: PropTypes.object,
    intl: PropTypes.object,
    createUser: PropTypes.func,
    createOrder: PropTypes.func.isRequired,
    fixedInterval: PropTypes.string,
    fixedAmount: PropTypes.number,
    skipStepDetails: PropTypes.bool,
    step: PropTypes.string,
    verb: PropTypes.oneOf(['new-donate', 'new-contribute']),
    /** @ignore from withUser */
    LoggedInUser: PropTypes.object,
  };

  constructor(props) {
    super(props);
    this.mainContainerRef = React.createRef();
    this.state = {
      stepProfile: null,
      stepPayment: null,
      stepSummary: null,
      stepDetails: {
        quantity: 1,
        interval: props.fixedInterval || props.tier?.interval,
        amount: props.fixedAmount || getDefaultTierAmount(props.tier),
      },
    };
  }

  onComplete = () => {
    const { stepDetails, stepPayment, stepProfile, stepSummary } = this.state;
    // TODO We're still relying on profiles from V1 (LoggedInUser)
    const fromAccount = typeof stepProfile.id === 'string' ? { id: stepProfile.id } : { legacyId: stepProfile.id };

    const order = {
      quantity: stepDetails.quantity,
      amount: { valueInCents: stepDetails.amount },
      frequency: getGQLV2FrequencyFromInterval(stepDetails.interval),
      platformContributionAmount: stepDetails.feesOnTop && { valueInCents: stepDetails.feesOnTop },
      fromAccount,
      toAccount: pick(this.props.collective, ['id']),
      customData: stepDetails.customData,
      paymentMethod: stepPayment?.paymentMethod && {
        ...pick(stepPayment.paymentMethod, ['id']),
        type: stepPayment.paymentMethod.type || stepPayment.paymentMethod.providerType,
      },
      taxes: stepSummary && [
        {
          type: 'VAT',
          amount: stepSummary.amount || 0,
          country: stepSummary.countryISO,
          idNumber: stepSummary.number,
        },
      ],
    };

    console.log(order);
    return;
    return this.props.createOrder({ variables: { order } });
  };

  getEmailRedirectURL() {
    let currentPath = window.location.pathname;
    if (window.location.search) {
      currentPath = currentPath + window.location.search;
    } else {
      currentPath = `${currentPath}?`;
    }
    // add 'emailRedirect' to the query so we can load the Payment step when
    // the user comes back from signing up to make a recurring contribution
    currentPath = `${currentPath.replace('profile', 'payment')}&emailRedirect=true`;
    return encodeURIComponent(currentPath);
  }

  createProfileForRecurringContributions = async data => {
    if (this.state.submitting) {
      return false;
    }

    const user = pick(data, ['email', 'name']);

    this.setState({ submitting: true });

    try {
      await this.props.createUser({
        variables: {
          user,
          redirect: this.getEmailRedirectURL(),
          websiteUrl: getWebsiteUrl(),
        },
      });
      await Router.pushRoute('signinLinkSent', { email: user.email });
      window.scrollTo(0, 0);
    } catch (error) {
      console.log(error);
      this.setState({ error: error.message, submitting: false });
      window.scrollTo(0, 0);
    }
  };

  /** Steps component callback  */
  onStepChange = async step => this.pushStepRoute(step.name);

  /** Navigate to another step, ensuring all route params are preserved */
  pushStepRoute = async (stepName, routeParams = {}) => {
    const { collective, tier, LoggedInUser } = this.props;
    const { stepDetails, stepProfile } = this.state;

    const params = {
      verb: this.props.verb || 'new-donate',
      collectiveSlug: collective.slug,
      step: stepName === 'details' ? undefined : stepName,
      totalAmount: this.props.fixedAmount ? this.props.fixedAmount.toString() : undefined,
      interval: this.props.fixedInterval || undefined,
      ...pick(this.props, ['interval', 'description', 'redirect']),
      ...routeParams,
    };

    let route = 'new-donate';
    if (tier) {
      params.tierId = tier.legacyId;
      params.tierSlug = tier.slug;
      if (tier.type === 'TICKET' && collective.parentCollective) {
        route = 'orderEventTier';
        params.collectiveSlug = collective.parentCollective.slug;
        params.eventSlug = collective.slug;
        params.verb = 'events';
      } else {
        route = 'new-contribute';
        params.verb = 'new-contribute'; // Enforce "contribute" verb for ordering tiers
      }
    } else if (params.verb === 'contribute') {
      // Never use `contribute` as verb if not using a tier (would introduce a route conflict)
      params.verb = 'new-donate';
    }

    // Reset errors if any
    if (this.state.error) {
      this.setState({ error: null });
    }

    // Navigate to the new route
    if (stepName === 'success') {
      await Router.pushRoute(`${route}/success`);
    } else if (stepName === 'payment' && !LoggedInUser && stepDetails?.interval) {
      await this.createProfileForRecurringContributions(stepProfile);
    } else {
      await Router.pushRoute(route, params);
    }

    if (this.mainContainerRef.current) {
      this.mainContainerRef.current.scrollIntoView({ behavior: 'smooth' });
    } else {
      window.scrollTo(0, 0);
    }
  };

  // Memoized helpers
  isFixedContribution = memoizeOne(isFixedContribution);
  getTierMinAmount = memoizeOne(getTierMinAmount);
  taxesMayApply = memoizeOne(taxesMayApply);

  canHaveFeesOnTop() {
    if (!this.props.collective.platformContributionAvailable) {
      return false;
    } else if (this.props.tier?.type === TierTypes.TICKET) {
      return false;
    } else if (this.state.stepProfile?.type === CollectiveType.COLLECTIVE) {
      return this.state.stepProfile.host?.id && this.state.stepProfile.host.id === this.props.host?.id;
    } else {
      return true;
    }
  }

  /** Returns the steps list */
  getSteps() {
    const { fixedInterval, fixedAmount, intl, collective, host, tier } = this.props;
    const { stepDetails, stepPayment, stepSummary } = this.state;
    const isFixedContribution = this.isFixedContribution(tier, fixedAmount, fixedInterval);
    const minAmount = this.getTierMinAmount(tier);
    const noPaymentRequired = minAmount === 0 && get(stepDetails, 'amount') === 0;
    const steps = [
      {
        name: 'details',
        label: intl.formatMessage(stepsLabels.details),
        isCompleted: Boolean(stepDetails && stepDetails.amount >= minAmount),
      },
      {
        name: 'profile',
        label: intl.formatMessage(stepsLabels.contributeAs),
        isCompleted: Boolean(this.state.stepProfile),
      },
    ];

    // Hide step payment if using a free tier with fixed price
    if (!(minAmount === 0 && isFixedContribution)) {
      steps.push({
        name: 'payment',
        label: intl.formatMessage(stepsLabels.payment),
        isCompleted: Boolean(noPaymentRequired || stepPayment),
      });
    }

    // Show the summary step only if the order has tax
    if (this.taxesMayApply(collective, host, tier)) {
      steps.push({
        name: 'summary',
        label: intl.formatMessage(stepsLabels.summary),
        isCompleted: noPaymentRequired || get(stepSummary, 'isReady', false),
      });
    }

    return steps;
  }

  render() {
    const { collective, tier, LoggedInUser, skipStepDetails } = this.props;
    return (
      <Steps
        steps={this.getSteps()}
        currentStepName={this.props.step}
        onStepChange={this.onStepChange}
        onComplete={this.onComplete}
        skip={skipStepDetails ? ['details'] : null}
      >
        {({
          steps,
          currentStep,
          lastVisitedStep,
          goNext,
          goBack,
          goToStep,
          prevStep,
          nextStep,
          isValidating,
          isValidStep,
        }) =>
          !isValidStep ? (
            <Loading />
          ) : (
            <Container
              display="flex"
              flexDirection="column"
              alignItems="center"
              justifyContent="center"
              py={[3, 4, 5]}
              mb={4}
              ref={this.mainContainerRef}
            >
              <Box px={[2, 3]} mb={4}>
                <ContributionFlowHeader collective={collective} />
              </Box>
              <StepsProgressBox mb={3} width={[1.0, 0.8]}>
                <ContributionFlowStepsProgress
                  steps={steps}
                  currentStep={currentStep}
                  lastVisitedStep={lastVisitedStep}
                  goToStep={goToStep}
                  stepProfile={this.state.stepProfile}
                  stepDetails={this.state.stepDetails}
                  stepPayment={this.state.stepPayment}
                  submitted={this.state.submitted}
                  loading={this.state.loading || this.state.submitting}
                  currency={collective.currency}
                  isFreeTier={this.getTierMinAmount(tier) === 0}
                />
              </StepsProgressBox>
              {/* main container */}
              <Grid
                px={[2, 3]}
                gridTemplateColumns={[
                  'minmax(200px, 600px)',
                  null,
                  '0fr minmax(300px, 600px) 1fr',
                  '1fr minmax(300px, 600px) 1fr',
                ]}
              >
                <Box />
                <Box as="form" onSubmit={e => e.preventDefault()} maxWidth="100%">
                  <ContributionFlowMainContainer
                    collective={collective}
                    tier={tier}
                    mainState={this.state}
                    onChange={data => this.setState(data)}
                    step={currentStep}
                    showFeesOnTop={this.canHaveFeesOnTop()}
                  />
                  <Box mt={[4, 5]}>
                    <NewContributionFlowButtons
                      goNext={goNext}
                      goBack={goBack}
                      step={currentStep}
                      prevStep={prevStep}
                      nextStep={nextStep}
                      isRecurringContributionLoggedOut={!LoggedInUser && this.state.stepDetails?.interval}
                      isValidating={isValidating}
                    />
                  </Box>
                </Box>
                <Box minWidth={[null, '300px']} mt={[4, null, 0]} ml={[0, 3, 4, 5]}>
                  <Box maxWidth={['100%', null, 300]} px={[1, null, 0]}>
                    <SafeTransactionMessage />
                    <NewContributeFAQ mt={4} titleProps={{ mb: 2 }} />
                  </Box>
                </Box>
              </Grid>
            </Container>
          )
        }
      </Steps>
    );
  }
}

const addCreateOrderMutation = graphql(
  gqlV2/* GraphQL */ `
    mutation CreateOrder($order: OrderCreateInput!) {
      createOrder(order: $order) {
        id
        status
      }
    }
  `,
  {
    name: 'createOrder',
    options: {
      context: API_V2_CONTEXT,
    },
  },
);

export default injectIntl(withUser(addSignupMutation(addCreateOrderMutation(ContributionFlow))));
