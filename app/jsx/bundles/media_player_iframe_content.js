/*
 * Copyright (C) 2019 - present Instructure, Inc.
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

import CanvasMediaPlayer from '../shared/media/CanvasMediaPlayer'
import React from 'react'
import ReactDOM from 'react-dom'
import ready from '@instructure/ready'

ready(() => {
  // get the media_id from something like
  //  `http://canvas.example.com/media_objects_iframe/m-48jGWTHdvcV5YPdZ9CKsqbtRzu1jURgu`
  // or
  //  `http://canvas.example.com/media_objects_iframe/?href=http://url/to/file.mov`
  const media_id = window.location.pathname.split('media_objects_iframe/').pop()
  const media_href_match = window.location.search.match(/href=([^&]+)/)
  let href_source
  if (media_href_match) {
    href_source = [{
      src: decodeURIComponent(media_href_match[1]),
    }]
  }

  // TODO: when the fullscreen button is missing, the source chooser button is up against
  // the right edge of the frame. When its popup menu is opened, the outset focus ring
  // extends beyond the container's edge, causing a horiz. scrollbar, which steals vert.
  // space and causes a vert. scrollbar, and this oscillates.
  // remove the 3px margins when this jitter is fixed
  const margin = document.fullscreenEnabled ? '0' : '3px 3px 0'
  document.body.setAttribute('style', `margin: ${margin}; padding: 0; border-style: none`)

  const div = document.body.firstElementChild
  ReactDOM.render(
    <CanvasMediaPlayer media_id={media_id} media_sources={href_source || ENV.media_sources} />,
    document.body.appendChild(div)
  )
})
