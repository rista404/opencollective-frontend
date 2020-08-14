import React, { Fragment } from 'react';
import PropTypes from 'prop-types';
import { useMutation, useQuery } from '@apollo/client';
import themeGet from '@styled-system/theme-get';
import { Field, Form, Formik } from 'formik';
import { defineMessages, FormattedMessage, injectIntl, useIntl } from 'react-intl';
import styled, { css } from 'styled-components';

import { API_V2_CONTEXT, gqlV2 } from '../../lib/graphql/helpers';

import Avatar from '../../components/Avatar';
import Container from '../../components/Container';
import { Box, Flex } from '../../components/Grid';
import Loading from '../../components/Loading';
import StyledButton from '../../components/StyledButton';
import StyledInputField from '../../components/StyledInputField';
import StyledTextarea from '../../components/StyledTextarea';
import { H3, P, Span } from '../../components/Text';
import { withUser } from '../../components/UserProvider';

const PUBLIC_MESSAGE_MAX_LENGTH = 20;

// Styled components
const PublicMessageContainer = styled(Container)`
  display: flex;
  flex-direction: column;
  background: ${themeGet('colors.white.full')};
  border: 1px solid ${themeGet('colors.black.400')};
  border-radius: 10px;
`;

// GraphQL
const postContributionPublicMessageMutation = gqlV2/* GraphQL */ `
  mutation EditPublicMessage($FromCollectiveLegacyId: Int!, $ToCollectiveId: String!, $message: String) {
    editPublicMessage(
      FromCollectiveLegacyId: $FromCollectiveLegacyId
      ToCollectiveId: $ToCollectiveId
      message: $message
    ) {
      id
      publicMessage
      tier {
        id
      }
      collective {
        id
        slug
      }
    }
  }
`;

// Messages
const messages = defineMessages({
  publicMessagePlaceholder: {
    id: 'contribute.publicMessage.placeholder',
    defaultMessage: 'Motivate others to contribute in 140 characters :) ...',
  },
});

const ContributionFlowPublicMessage = ({ collective, stepProfile }) => {
  const intl = useIntl();
  const [postPublicMessage] = useMutation(postContributionPublicMessageMutation, {
    context: API_V2_CONTEXT,
  });

  const initialValues = {
    publicMessage: '',
  };

  const submitPublicMessage = async values => {
    console.log('yeet');
    console.log(values);
    // await postPublicMessage({
    //   variables: {
    //     FromCollectiveLegacyId: stepProfile.collective.id,
    //     ToCollectiveId: collective.id,
    //     message: message,
    //   },
    // });
    return;
  };

  return (
    <PublicMessageContainer width={400} height={112} mt={2}>
      <Formik initialValues={initialValues} onSubmit={submitPublicMessage}>
        {formik => {
          const { values, handleSubmit, isSubmitting } = formik;

          return (
            <Form>
              <StyledInputField
                name="publicMessage"
                htmlFor="publicMessage"
                // disabled={loading}
              >
                {inputProps => (
                  <Field
                    as={StyledTextarea}
                    {...inputProps}
                    resize="none"
                    border="none"
                    withOutline={false}
                    maxLength={PUBLIC_MESSAGE_MAX_LENGTH}
                    minWidth={300}
                    minHeight={75}
                    fontSize="14px"
                    value={values.publicMessage}
                    placeholder={intl.formatMessage(messages.publicMessagePlaceholder)}
                  />
                )}
              </StyledInputField>

              <Flex flexGrow={1} mt={1} px={3}>
                <Flex width={1 / 2} alignItems="center" justifyContent="flex-start">
                  <Avatar collective={stepProfile} radius={24} />
                  <Flex flexDirection="column" ml={2}>
                    <P fontSize="10px">
                      <em>
                        <FormattedMessage id="contribute.publicMessage.postingAs" defaultMessage="Posting as" />
                      </em>
                    </P>
                    <P fontSize="12px">{stepProfile.name}</P>
                  </Flex>
                </Flex>
                <Flex width={1 / 2} alignItems="center" justifyContent="flex-end">
                  <StyledButton
                    buttonSize="tiny"
                    // loading={loading}
                    type="submit"
                    onSubmit={handleSubmit}
                  >
                    <FormattedMessage id="contribute.publicMessage.post" defaultMessage="Post message" />
                  </StyledButton>
                </Flex>
              </Flex>
            </Form>
          );
        }}
      </Formik>
    </PublicMessageContainer>
  );
};

ContributionFlowPublicMessage.propTypes = {
  collective: PropTypes.object,
  stepProfile: PropTypes.object,
  intl: PropTypes.object,
};

export default injectIntl(withUser(ContributionFlowPublicMessage));
