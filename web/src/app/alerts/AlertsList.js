import React, { useState } from 'react'
import { PropTypes as p } from 'prop-types'
import gql from 'graphql-tag'
import {
  Hidden,
  ListItemText,
  Snackbar,
  SnackbarContent,
  makeStyles,
  isWidthDown,
} from '@material-ui/core'
import {
  ArrowUpward as EscalateIcon,
  Check as AcknowledgeIcon,
  Close as CloseIcon,
  Info as InfoIcon,
} from '@material-ui/icons'
import { useSelector } from 'react-redux'

import AlertsListFilter from './components/AlertsListFilter'
import AlertsListControls from './components/AlertsListControls'
import CreateAlertFab from './CreateAlertFab'
import UpdateAlertsSnackbar from './components/UpdateAlertsSnackbar'

import { formatTimeSince } from '../util/timeFormat'
import { urlParamSelector } from '../selectors'
import { useMutation, useQuery } from '@apollo/react-hooks'
import QueryList from '../lists/QueryList'
import useWidth from '../util/useWidth'

export const alertsListQuery = gql`
  query alertsList($input: AlertSearchOptions) {
    alerts(input: $input) {
      nodes {
        id
        alertID
        status
        summary
        details
        createdAt
        service {
          id
          name
        }
      }

      pageInfo {
        endCursor
        hasNextPage
      }
    }
  }
`

const updateMutation = gql`
  mutation UpdateAlertsMutation($input: UpdateAlertsInput!) {
    updateAlerts(input: $input) {
      status
      id
    }
  }
`

const escalateMutation = gql`
  mutation EscalateAlertsMutation($input: [Int!]) {
    escalateAlerts(input: $input) {
      status
      id
    }
  }
`

const useStyles = makeStyles((theme) => ({
  snackbar: {
    backgroundColor: theme.palette.primary['500'],
    height: '6.75em',
    width: '20em', // only triggers on desktop, 100% on mobile devices
  },
  snackbarIcon: {
    fontSize: 20,
    opacity: 0.9,
    marginRight: theme.spacing(1),
  },
  snackbarMessage: {
    display: 'flex',
    alignItems: 'center',
  },
}))

function getStatusFilter(s) {
  switch (s) {
    case 'acknowledged':
      return ['StatusAcknowledged']
    case 'unacknowledged':
      return ['StatusUnacknowledged']
    case 'closed':
      return ['StatusClosed']
    case 'all':
      return [] // empty array returns all statuses
    // active is the default tab
    default:
      return ['StatusAcknowledged', 'StatusUnacknowledged']
  }
}

export default function AlertsList(props) {
  const classes = useStyles()
  const width = useWidth()
  const isFullScreen = isWidthDown('md', width)

  const [checkedCount, setCheckedCount] = useState(0)

  // used if user dismisses snackbar before the auto-close timer finishes
  const [actionCompleteDismissed, setActionCompleteDismissed] = useState(true)

  // defaults to open unless favorited services are present or warning is dismissed
  const [favoritesWarningDismissed, setFavoritesWarningDismissed] = useState(
    false,
  )

  // get redux url vars
  const params = useSelector(urlParamSelector)
  const allServices = params('allServices')
  const filter = params('filter', 'active')
  const isFirstLogin = params('isFirstLogin')

  // query to see if the current user has any favorited services
  // if allServices is not true
  const favoritesQueryStatus = useQuery(
    gql`
      query($input: ServiceSearchOptions) {
        services(input: $input) {
          nodes {
            id
          }
        }
      }
    `,
    {
      variables: {
        input: {
          favoritesOnly: true,
          first: 1,
        },
      },
    },
  )

  // checks to show no favorites warning
  const noFavorites =
    !favoritesQueryStatus.data?.services?.nodes?.length &&
    !favoritesQueryStatus.loading
  const showNoFavoritesWarning =
    !favoritesWarningDismissed && // has not been dismissed
    !allServices && // all services aren't being queried
    !props.serviceID && // not viewing alerts from services page
    !isFirstLogin && // don't show two pop-ups at the same time
    noFavorites // and lastly, user has no favorited services

  /*
   * Closes the no favorites warning snackbar only if clicking
   * away to lose focus
   */
  function handleCloseNoFavoritesWarning(event, reason) {
    if (reason === 'clickaway') {
      setFavoritesWarningDismissed(false)
    }
  }

  // alerts list query variables
  const variables = {
    input: {
      filterByStatus: getStatusFilter(filter),
      first: 25,
      // default to favorites only, unless viewing alerts from a service's page
      favoritesOnly: !props.serviceID && !allServices,
    },
  }

  if (props.serviceID) {
    variables.input.filterByServiceID = [props.serviceID]
  }

  const [mutate, status] = useMutation(updateMutation)

  const makeUpdateAlerts = (newStatus) => (alertIDs) => {
    setCheckedCount(alertIDs.length)
    setActionCompleteDismissed(false)

    let mutation = updateMutation
    let variables = { input: { newStatus, alertIDs } }

    if (newStatus === 'StatusUnacknowledged') {
      mutation = escalateMutation
      variables = { input: alertIDs }
    }

    mutate({ mutation, variables })
  }

  let updateMessage, errorMessage
  if (status.error && !status.loading) {
    errorMessage = status.error.message
  }

  if (status.data && !status.loading) {
    const numUpdated =
      status.data.updateAlerts?.length ||
      status.data.escalateAlerts?.length ||
      0

    updateMessage = `${numUpdated} of ${checkedCount} alert${
      checkedCount === 1 ? '' : 's'
    } updated`
  }

  const showAlertActionSnackbar = Boolean(
    !actionCompleteDismissed && (errorMessage || updateMessage),
  )

  /*
   * Adds border of color depending on each alert's status
   * on left side of each list item
   */
  function getListItemStatus(s) {
    switch (s) {
      case 'StatusAcknowledged':
        return 'warn'
      case 'StatusUnacknowledged':
        return 'err'
      case 'StatusClosed':
        return 'ok'
    }
  }

  /*
   * Passes the proper actions to ListControls depending
   * on which tab is currently filtering the alerts list
   */
  function getActions() {
    const actions = []

    if (filter !== 'closed' && filter !== 'acknowledged') {
      actions.push({
        icon: <AcknowledgeIcon />,
        label: 'Acknowledge',
        onClick: makeUpdateAlerts('StatusAcknowledged'),
      })
    }

    if (filter !== 'closed') {
      actions.push(
        {
          icon: <CloseIcon />,
          label: 'Close',
          onClick: makeUpdateAlerts('StatusClosed'),
        },
        {
          icon: <EscalateIcon />,
          label: 'Escalate',
          onClick: makeUpdateAlerts('StatusUnacknowledged'),
        },
      )
    }

    return actions
  }

  // render
  return (
    <React.Fragment>
      <QueryList
        query={alertsListQuery}
        infiniteScroll
        mapDataNode={(a) => ({
          id: a.id,
          status: getListItemStatus(a.status),
          title: `${a.alertID}: ${a.status
            .toUpperCase()
            .replace('STATUS', '')}`,
          subText: (props.serviceID ? '' : a.service.name + ': ') + a.summary,
          action: <ListItemText secondary={formatTimeSince(a.createdAt)} />,
          url: `/alerts/${a.id}`,
          selectable: a.status !== 'StatusClosed',
        })}
        variables={variables}
        filter={<AlertsListFilter />}
        cardHeader={
          <Hidden mdDown>
            <AlertsListControls />
          </Hidden>
        }
        checkboxActions={getActions()}
      />

      <CreateAlertFab
        serviceID={props.serviceID}
        showFavoritesWarning={showNoFavoritesWarning}
        transition={
          isFullScreen && (showNoFavoritesWarning || showAlertActionSnackbar)
        }
      />

      {/* Update message after using checkbox actions */}
      <UpdateAlertsSnackbar
        errorMessage={errorMessage}
        onClose={() => setActionCompleteDismissed(true)}
        open={showAlertActionSnackbar}
        updateMessage={updateMessage}
      />

      {/* No favorites warning when viewing alerts */}
      <Snackbar
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'left',
        }}
        open={showNoFavoritesWarning}
        onClose={handleCloseNoFavoritesWarning}
      >
        <SnackbarContent
          className={classes.snackbar}
          aria-describedby='client-snackbar'
          message={
            <span id='client-snackbar' className={classes.snackbarMessage}>
              <InfoIcon className={classes.snackbarIcon} />
              It looks like you have no favorited services. Visit your most used
              services to set them as a favorite, or enable the filter to view
              alerts for all services.
            </span>
          }
        />
      </Snackbar>
    </React.Fragment>
  )
}

AlertsList.propTypes = {
  serviceID: p.string,
}
