/*
 * Copyright (C) 2018 - present Instructure, Inc.
 *
 * This file is part of Canvas.
 *
 * Canvas is free software: you can redistribute it and/or modify it under
 * the terms of the GNU Affero General Public License as published by the Free
 * Software Foundation, version 3 of the License.
 *
 * Canvas is distributed in the hope that it will be useful, but WITHOUT ANY
 * WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR
 * A PARTICULAR PURPOSE. See the GNU Affero General Public License for more
 * details.
 *
 * You should have received a copy of the GNU Affero General Public License along
 * with this program. If not, see <http://www.gnu.org/licenses/>.
 */

import React from 'react'
import _ from 'lodash'
import I18n from 'i18n!IndividualStudentMasteryOutcomePopover'
import {View, Flex} from '@instructure/ui-layout'
import {Text, Link} from '@instructure/ui-elements'
import {ScreenReaderContent} from '@instructure/ui-a11y'
import CalculationMethodContent from 'compiled/models/grade_summary/CalculationMethodContent'
import {Popover} from '@instructure/ui-overlays'
import {IconInfoLine} from '@instructure/ui-icons'
import DatetimeDisplay from '../../shared/DatetimeDisplay'
import {CloseButton} from '@instructure/ui-buttons'
import * as shapes from './shapes'

export default class OutcomePopover extends React.Component {
  static propTypes = {
    outcome: shapes.outcomeShape.isRequired,
    outcomeProficiency: shapes.outcomeProficiencyShape
  }

  static defaultProps = {
    outcomeProficiency: null
  }

  constructor () {
    super()
    this.state = { linkHover: false, linkClicked: false }
  }

  getSelectedRating () {
    const { outcomeProficiency } = this.props
    const { points_possible, mastery_points, score } = this.props.outcome
    const hasScore = score >= 0
    if (outcomeProficiency && hasScore) {
      const totalPoints = points_possible || mastery_points
      const percentage = totalPoints ? (score / totalPoints) : score
      const maxRating = outcomeProficiency.ratings[0].points
      const scaledScore = maxRating * percentage
      return _.find(outcomeProficiency.ratings, (r) => (scaledScore >= r.points)) || _.last(outcomeProficiency.ratings)
    } else if (hasScore) {
      return _.find(this.defaultProficiency(mastery_points).ratings, (r) => (score >= r.points))
    }
    return null
  }

  defaultProficiency = _.memoize((mastery_points) => (
    {
      ratings: [
        {points: mastery_points * 1.5, color: '127A1B', description: I18n.t('Exceeds Mastery')},
        {points: mastery_points, color: '00AC18', description: I18n.t('Meets Mastery')},
        {points: mastery_points/2, color: 'FAB901', description: I18n.t('Near Mastery')},
        {points: 0, color: 'EE0612', description: I18n.t('Well Below Mastery')}
      ]
    }
  ))

  latestTime () {
    const { outcome } = this.props
    if (outcome.results.length > 0) {
      return _.sortBy(outcome.results, (r) => (r.submitted_or_assessed_at))[0].submitted_or_assessed_at
    }
    return null
  }

  renderPopoverContent () {
    const selectedRating = this.getSelectedRating()
    const latestTime = this.latestTime()
    const popoverContent = new CalculationMethodContent(this.props.outcome).present()
    const {
      method,
      exampleText,
      exampleScores,
      exampleResult
    } = popoverContent
    const { outcome } = this.props
    return (
      <View as='div' padding='large' maxWidth='30rem'>
        <CloseButton placement='end' onClick={() => this.setState({linkHover: false, linkClicked: false})}>
          {I18n.t('Click to close outcome details popover')}
        </CloseButton>
        <Text size='small'>
          <Flex
            alignItems='stretch'
            direction='row'
            justifyItems='space-between'
          >
            <Flex.Item grow shrink>
              { /* word-wrap used for IE support */ }
              <div style={{wordWrap: 'break-word', overflowWrap: 'break-word'}}>{outcome.title}</div>
              <div>{I18n.t('Last Assessment: ')}
                { latestTime ?
                  <DatetimeDisplay datetime={latestTime} format='%b %d, %l:%M %p' /> :
                  I18n.t('No submissions')
                }
              </div>
            </Flex.Item>
            <Flex.Item grow shrink align='stretch'>
              <Text size='small' weight='bold'>
                <div>
                  {selectedRating &&
                  <div style={{color: `#${selectedRating.color}`, textAlign: 'end'}}>
                    {selectedRating.description}
                  </div>}
                </div>
              </Text>
            </Flex.Item>
          </Flex>
          <hr role='presentation'/>
          <div>
            <Text size='small' weight='bold'>{I18n.t('Calculation Method')}</Text>
            <div>{method}</div>
            <div style={{padding: '0.5rem 0 0 0'}}><Text size='small' weight="bold">{I18n.t('Example')}</Text></div>
            <div>{exampleText}</div>
            <div>{I18n.t('1- Item Scores: %{exampleScores}', { exampleScores })}</div>
            <div>{I18n.t('2- Final Score: %{exampleResult}', { exampleResult })}</div>
          </div>
        </Text>
      </View>
    )
  }

  render () {
    const popoverContent = this.renderPopoverContent()
    return (
      <span>
        <Popover
          show={this.state.linkHover || this.state.linkClicked}
          onDismiss={() => this.setState({linkHover: false, linkClicked: false})}
          placement="bottom"
          on={['hover', 'click']}
          shouldContainFocus
        >
          <Popover.Trigger>
            <Link
              onClick={() => this.setState(prevState => ({linkClicked: !prevState.linkClicked}))}
              onMouseEnter={() => this.setState({linkHover: true})}
              onMouseLeave={() => this.setState({linkHover: false})}
            >
              <span style={{color: 'black'}}><IconInfoLine /></span>
              <span>
              {!this.state.linkClicked &&
                <ScreenReaderContent>{I18n.t('Click to expand outcome details')}</ScreenReaderContent>
              }
              </span>
            </Link>
          </Popover.Trigger>
          <Popover.Content>
            {popoverContent}
          </Popover.Content>
        </Popover>
      </span>
    )
  }
}
