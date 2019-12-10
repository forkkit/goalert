import { Chance } from 'chance'
const c = new Chance()
import { testScreen } from '../support'

testScreen('Schedules', testSchedules)

function testSchedules(screen: ScreenFormat) {
  describe('Creation', () => {
    it('should create a schedule', () => {
      const name = c.word({ length: 8 })
      const description = c.sentence({ words: 5 })

      cy.visit('/schedules')

      cy.pageFab()
      cy.get('div[role=dialog]').should('contain', 'Create New Schedule')

      cy.get('input[name=name]')
        .type(name)
        .should('have.value', name)
      cy.get('textarea[name=description]')
        .type(description)
        .should('have.value', description)

      cy.get('button')
        .contains('Submit')
        .click()

      // verify on details by content headers
      cy.get('[data-cy=details-heading]').should('contain', name)
      cy.get('[data-cy=details]').should('contain', description)
    })
  })

  describe('List Page', () => {
    it('should find a schedule', () => {
      cy.createSchedule().then(sched => {
        cy.visit('/schedules')
        cy.pageSearch(sched.name)
        cy.get('body')
          .should('contain', sched.name)
          .should('contain', sched.description)
      })
    })
  })

  // todo: change filters test
  describe('Details Page', () => {
    let rot: Rotation
    let sched: Schedule
    beforeEach(() => {
      cy.createRotation()
        .then(r => {
          rot = r
        })
        .createSchedule()
        .then(s => {
          sched = s
          return cy.visit('/schedules/' + sched.id)
        })
    })

    it('should delete a schedule', () => {
      cy.pageAction('Delete Schedule')
      cy.get('button')
        .contains('Confirm')
        .click()

      cy.url().should('eq', Cypress.config().baseUrl + '/schedules')

      cy.pageSearch(sched.name)
      cy.get('body').should('contain', 'No results')
      cy.reload()
      cy.get('body').should('contain', 'No results')
    })

    it('should edit a schedule', () => {
      const newName = c.word({ length: 5 })
      const newDesc = c.word({ length: 5 })
      const newTz = 'Africa/Accra'

      cy.pageAction('Edit Schedule')
      cy.get('input[name=name]')
        .should('have.value', sched.name)
        .clear()
        .should('be.empty')
        .type(newName) // type in new name
        .should('have.value', newName)

      cy.get('textarea[name=description]')
        .should('have.value', sched.description)
        .clear()
        .should('be.empty')
        .type(newDesc) // type in new description
        .should('have.value', newDesc)

      cy.get('input[name=time-zone]').selectByLabel(newTz)

      cy.get('button')
        .contains('Submit')
        .click()

      // verify changes occurred
      cy.reload()
      cy.get('[data-cy=details-heading]').should('contain', newName)
      cy.get('[data-cy=details]').should('contain', newDesc)
      cy.get('[data-cy=title-footer]').should('contain', newTz)
    })

    it('should navigate to and from assignments', () => {
      cy.navigateToAndFrom(
        screen,
        'Schedule Details',
        sched.name,
        'Assignments',
        `${sched.id}/assignments`,
      )
    })

    it('should navigate to and from escalation policies', () => {
      cy.navigateToAndFrom(
        screen,
        'Schedule Details',
        sched.name,
        'Escalation Policies',
        `${sched.id}/escalation-policies`,
      )
    })

    it('should navigate to and from overrides', () => {
      cy.navigateToAndFrom(
        screen,
        'Schedule Details',
        sched.name,
        'Overrides',
        `${sched.id}/overrides`,
      )
    })

    it('should navigate to and from shifts', () => {
      cy.navigateToAndFrom(
        screen,
        'Schedule Details',
        sched.name,
        'Shifts',
        `${sched.id}/shifts`,
      )
    })

    it('should view shifts', () => {
      cy.setScheduleTarget({
        scheduleID: sched.id,
        target: { type: 'rotation', id: rot.id },
        rules: [
          {
            start: '00:00',
            end: '00:00',
            weekdayFilter: [true, true, true, true, true, true, true],
          },
        ],
      }).then(tgt => {
        cy.get('li')
          .contains('Shifts')
          .click()
        cy.reload()
        cy.get('[data-cy=flat-list-item-subheader]').should('contain', 'Today')
        cy.get('[data-cy=flat-list-item-subheader]').should(
          'contain',
          'Tomorrow',
        )
        cy.get('p').should('contain', 'Showing shifts')
      })
    })

    it('should view shifts after typing in start date', () => {
      cy.get('li')
        .contains('Shifts')
        .click()
      cy.reload()

      cy.get('button[title="Filter"').click()
      cy.get('div[data-cy="start-date"] input')
        .clear()
        .type('09012020')
      cy.get('button[data-cy="filter-done"]').click()

      cy.get('body').should(
        'contain',
        'Showing shifts up to 2 weeks from 9/1/2020',
      )
    })
  })

  describe('Schedule Assignments', () => {
    let rot: Rotation
    let sched: ScheduleTarget
    beforeEach(() => {
      cy.createRotation()
        .then(r => {
          rot = r
          return cy.setScheduleTarget({
            target: { id: r.id, type: 'rotation' },
          })
        })
        .then(s => {
          sched = s
          return cy.visit('/schedules/' + sched.schedule.id + '/assignments')
        })
    })

    it('should add a rotation as an assignment', () => {
      cy.pageFab('Rotation')

      // select create rotation
      cy.get('input[name=targetID]').selectByLabel(rot.name)
      cy.get('button')
        .contains('Submit')
        .click()

      cy.get('body').contains('li', rot.name)
    })

    it('should delete an assignment', () => {
      cy.get('body')
        .contains('li', rot.name)
        .find('button[data-cy=other-actions]')
        .menu('Delete')

      cy.get('body')
        .contains('button', 'Confirm')
        .click()

      cy.get('body').should('not.contain', rot.name)
    })

    it('should edit an assignment', () => {
      // todo: mobile dialog is completely different
      if (screen === 'mobile' || screen === 'tablet') return

      cy.get('body')
        .contains('li', rot.name)
        .find('button[data-cy=other-actions]')
        .menu('Edit')

      cy.get('input[name=Wednesday]').click()
      cy.get('body')
        .contains('button', 'Submit')
        .click()
      cy.get('body').contains('li', rot.name)
    })

    it('should edit then delete an assignment rule', () => {
      // todo: mobile dialog is completely different
      if (screen === 'mobile' || screen === 'tablet') return

      cy.get('body')
        .contains('li', rot.name)
        .get('button[data-cy=other-actions]')
        .menu('Edit')

      cy.get('input[name=Wednesday]').click()
      cy.get('button[aria-label="Delete rule"]').should('not.exist')
      cy.get('button[aria-label="Add rule"').click()
      cy.get('button[aria-label="Add rule"').click()

      cy.get('button[aria-label="Delete rule"]')
        .should('have.length', 3)
        .first()
        .click()
      cy.get('body')
        .contains('button', 'Submit')
        .click()
      cy.get('body').should('contain', 'Always')
    })

    it('should update time fields by typing', () => {
      cy.get('body')
        .contains('li', rot.name)
        .get('button[data-cy=other-actions]')
        .menu('Edit')

      // Type in invalid input
      cy.get('div[data-cy="start-time"] input')
        .clear()
        .type('88')
      cy.get('div[data-cy="end-time"] input')
        .clear()
        .type('88')

      // Test client validation
      cy.get('body')
        .contains('button', 'Submit')
        .click()
      cy.get('p[data-cy="start-time-form-helper"]').should(
        'contain',
        'Invalid time',
      )
      cy.get('p[data-cy="end-time-form-helper"]').should(
        'contain',
        'Invalid time',
      )

      // Fix and submit
      const start = '0900A'
      const end = '0529P'
      cy.get('div[data-cy="start-time"] input')
        .clear()
        .type(start)
      cy.get('div[data-cy="end-time"] input')
        .clear()
        .type(end)
      cy.get('button')
        .contains('Submit')
        .click()

      // Verify successful
      cy.get('body').should('contain', '9:00 AM to 5:29 PM')
    })
  })

  describe('Schedule Overrides', () => {
    let sched: Schedule
    beforeEach(() => {
      cy.createSchedule().then(s => {
        sched = s
        return cy.visit('/schedules/' + sched.id + '/overrides')
      })
    })

    it('should create an add override', () => {
      cy.fixture('users').then(users => {
        cy.get('span').should('contain', 'No results')

        cy.pageFab('Add')

        cy.get('input[name=addUserID]').selectByLabel(users[0].name)
        cy.get('button')
          .contains('Submit')
          .click()

        cy.get('span').should('contain', users[0].name)
        cy.get('p').should('contain', 'Added from')
        expect('span').to.not.contain('No results')
      })
    })

    it('should create a remove override', () => {
      cy.fixture('users').then(users => {
        cy.get('span').should('contain', 'No results')

        cy.pageFab('Remove')

        cy.get('input[name=removeUserID]').selectByLabel(users[0].name)
        cy.get('button')
          .contains('Submit')
          .click()

        cy.get('span').should('contain', users[0].name)
        cy.get('p').should('contain', 'Removed from')
        expect('span').to.not.contain('No results')
      })
    })

    it('should create a replace override', () => {
      cy.fixture('users').then(users => {
        cy.get('span').should('contain', 'No results')

        cy.pageFab('Replace')

        cy.get('input[name=removeUserID]').selectByLabel(users[0].name)
        cy.get('input[name=addUserID]').selectByLabel(users[1].name)

        cy.get('button')
          .contains('Submit')
          .click()

        cy.get('span').should('contain', users[1].name)
        cy.get('p').should('contain', `Replaces ${users[0].name} from`)
        expect('span').to.not.contain('No results')
      })
    })

    it('should edit an override', () => {
      cy.fixture('users').then(users => {
        cy.get('body').should('contain', 'No results')

        cy.pageFab('Add')

        cy.get('input[name=addUserID]').selectByLabel(users[0].name)
        cy.get('button')
          .contains('Submit')
          .click()

        cy.get('body').should('not.contain', 'No results')

        cy.get('body').should('contain', users[0].name)

        cy.get('button[data-cy=other-actions]').menu('Edit')

        cy.get('input[name=addUserID]').selectByLabel(users[1].name)
        cy.get('button')
          .contains('Submit')
          .click()

        cy.get('body')
          .should('not.contain', users[0].name)
          .should('contain', users[1].name)

        cy.get('button[data-cy=other-actions]').menu('Delete')

        cy.get('button')
          .contains('Confirm')
          .click()

        cy.get('body').should('contain', 'No results')
      })
    })

    it('should type in date fields to create an override', () => {
      cy.fixture('users').then(users => {
        cy.get('span').should('contain', 'No results')

        cy.pageFab('Add')

        cy.get('input[name=addUserID]').selectByLabel(users[0].name)

        // Type in invalid input
        cy.get('div[data-cy="start-date"] input')
          .clear()
          .type('88')
        cy.get('div[data-cy="end-date"] input')
          .clear()
          .type('88')

        // Test client validation
        cy.get('button')
          .contains('Submit')
          .click()
        cy.get('p[data-cy="start-date-form-helper"]').should(
          'contain',
          'Invalid time',
        )
        cy.get('p[data-cy="end-date-form-helper"]').should(
          'contain',
          'Invalid time',
        )

        // Fix and submit
        const start = '090120201200P'
        const end = '090220200444P'
        cy.get('div[data-cy="start-date"] input')
          .clear()
          .type(start)
        cy.get('div[data-cy="end-date"] input')
          .clear()
          .type(end)
        cy.get('button')
          .contains('Submit')
          .click()

        // Verify successful
        cy.get('span').should('contain', users[0].name)
        cy.get('p').should('contain', 'Added from')
        cy.get('p').should('contain', 'Sep 1, 2020, 12:00 PM')
        cy.get('p').should('contain', 'Sep 2, 2020, 4:44 PM')
        expect('span').to.not.contain('No results')
      })
    })
  })
}
