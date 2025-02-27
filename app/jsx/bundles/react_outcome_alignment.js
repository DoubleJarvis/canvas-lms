/*
 * Copyright (C) 2015 - present Instructure, Inc.
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

import $ from 'jquery'
import ready from '@instructure/ready'
import React from 'react'
import ReactDOM from 'react-dom'
import OutcomeAlignmentDeleteLink from '../outcomes/OutcomeAlignmentDeleteLink'

ready(() => {
$('li.alignment').each((_, li) => {
  const $div = $(li).find('div.links')[0]

  ReactDOM.render(
    <OutcomeAlignmentDeleteLink
      has_rubric_association={$(li).data('has-rubric-association')}
      url={$(li).data('url')}
    />,
    $div
  )
})
})
