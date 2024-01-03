var fdApp = {
  client: null,
  data: {},

  interface: {
    trigger: async (action, value) => {
      await fdApp.client.interface.trigger(action, value);
    },
    notify: async (type, title, message) => {
      await fdApp.interface.trigger("showNotify", { type: type, title: title, message: message });
    },
    open: async (element, data) => {
      await fdApp.interface.trigger("click", { id: element, value: data || "" });
    }
  },

  init: async () => {
    fdApp.client = await app.initialized().then((_client) => {
      return _client;
    }, (error) => {
      console.error("freshdesk init error: ", error);
      fdApp.interface.notify("danger", "freshdesk init error:", error);
      return null;
    });
    if (fdApp.client !== null) {
      fdApp.interface.notify("success", "App", "Initialization Success");
      fdApp.client.events.on("app.activated", fdApp.app);
    } else {
      fdApp.interface.notify("danger", "App", "Initialization failed");
    }
  },

  invoke: async (name, data) => {
    return await fdApp.client.request.invokeTemplate(name, (data || {})).then((data) => {
      return JSON.parse(data.response);
    }, (error) => {
      console.error("freshdesk request error: ", name, JSON.stringify(data || {}), JSON.stringify(error));
      return null;
    });
  },

  app: async () => {

    const numberInput = document.getElementById('phoneNumber');
    const saveButton = document.getElementById('saveButton');

    function onClickSaveButton() {
      if (!isNaN(numberInput.value) && numberInput.value !== '' && numberInput.value !== null && (numberInput.value).length === 10 && (numberInput.value.charAt(0) === "6" || numberInput.value.charAt(0) === "7" || numberInput.value.charAt(0) === "8" || numberInput.value.charAt(0) === "9")) {
        fdApp.contact.search(numberInput.value);
        document.getElementById('validationText').hidden = true
      } else {
        fdApp.interface.notify("danger", "", "Please enter a valid number");
        document.getElementById('validationText').removeAttribute('hidden');
        document.getElementById('noContactText').hidden = true
        document.getElementById('noTicketText').hidden = true
        document.getElementById('parent').hidden = true
      }
    }

    window.onbeforeunload = function () {
      localStorage.setItem('number', numberInput.value)
    }

    const numberAfterRefresh = localStorage.getItem('number')
    const numberAfterTicketBack = sessionStorage.getItem('number')
    if ((numberAfterRefresh !== null && numberAfterRefresh !== '') || (numberAfterTicketBack !== null && numberAfterTicketBack !== '')) {
      numberInput.value = numberAfterRefresh || numberAfterTicketBack;
      onClickSaveButton()
      localStorage.removeItem('number')
      sessionStorage.removeItem('number')
    }

    saveButton.addEventListener('click', onClickSaveButton)

  },

  contact: {
    search: async (number) => {
      let query = ("\\\"" + ("phone:'" + encodeURIComponent(number) + "'") + "\\\"");
      try {
        let contacts = await fdApp.invoke("searchContact", { context: { query: query } });
        if (contacts.total < 1) {
          document.getElementById('noContactText').removeAttribute('hidden')
          document.getElementById('noTicketText').hidden = true
          document.getElementById('parent').hidden = true
        }
        else {
          document.getElementById('noContactText').hidden = true
          let requester_id = contacts.results[0].id;
          try {
            const ticketdetails = await fdApp.invoke("getTicket", { context: { requester_id: requester_id } });
            const specificTickets = []
            ticketdetails.map((data) => {
              if (data.requester_id === requester_id) {
                specificTickets.push(data)
              }
            })
            if (specificTickets.length < 1) {
              document.getElementById('noTicketText').removeAttribute('hidden')
              document.getElementById('parent').hidden = true
            }
            else {
              document.getElementById('parent').removeAttribute('hidden')
              document.getElementById('noTicketText').hidden = true

              const one_day = 24 * 60 * 60 * 1000

              const parentElement = document.getElementById('parent')

              specificTickets.map((ticket) => {
                console.log(ticket)
                const newCardDiv = document.createElement('div');
                newCardDiv.className = 'card';

                const grid1 = document.createElement('div');
                grid1.className = 'grid1';

                const grid2 = document.createElement('div');
                grid2.className = 'grid2';

                async function onClickCard() {
                  try {
                    fdApp.interface.open("ticket", ticket.id);
                    const numberInput = document.getElementById('phoneNumber');
                    sessionStorage.setItem('number', numberInput.value)
                  } catch (error) {
                    console.error(error);
                    fdApp.interface.notify("danger", "ticket:", error);
                  }
                }

                newCardDiv.addEventListener('click', onClickCard);

                const ticketType = document.createElement('p');
                ticketType.textContent = ((ticket.due_by > new Date().toISOString) ? "OverDue" : (Math.abs(new Date() - new Date(ticket.fr_due_by)) < one_day)) ? "First Response Due" : "New"
                ticketType.className = ((Math.abs(new Date() - new Date(ticket.fr_due_by)) < one_day) || (ticket.due_by > new Date().toISOString)) ? "overDue" : "new"

                const subject = document.createElement('p');
                const description = document.createElement('p');
                const id = document.createElement('p');
                description.textContent = ticket.subject;
                id.textContent = `#${ticket.id}`
                id.className = "id"
                subject.textContent = description.textContent + " " + id.textContent
                subject.className = "subject"


                const information = document.createElement('p');
                information.className = "information"

                function toDisplayTimeContent(timeDifference) {
                  const days = Math.floor(timeDifference / (1000 * 60 * 60 * 24));
                  const hours = Math.floor((timeDifference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                  const minutes = Math.floor((timeDifference % (1000 * 60 * 60)) / (1000 * 60));
                  const seconds = Math.floor((timeDifference % (1000 * 60)) / 1000);

                  if (days > 0) {
                    timeDifference = `${days} days`
                  }
                  else if (hours > 0) {
                    timeDifference = `${hours} hours`
                  }
                  else if (minutes > 0) {
                    timeDifference = `${minutes} minutes`
                  }
                  else {
                    timeDifference = `${seconds} seconds`
                  }
                  return timeDifference;
                }

                let timeAfterticketCreation = "-"
                if (new Date().toISOString > ticket.created_at) {
                  timeAfterticketCreation = new Date() - new Date(ticket.created_at)
                  timeAfterticketCreation = toDisplayTimeContent(timeAfterticketCreation)
                }

                let timeafterOverDue = "-"
                let timebeforefeDue = "-"
                if (ticket.fr_due_by < new Date().toISOString) {
                  timebeforefeDue = new Date() - new Date(ticket.fr_due_by)
                  timebeforefeDue = toDisplayTimeContent(timebeforefeDue)
                }
                else if (ticket.due_by < new Date().toISOString) {
                  timeafterOverDue = new Date() - new Date(ticket.due_by)
                  timeafterOverDue = toDisplayTimeContent(timeafterOverDue)
                }

                if (timebeforefeDue !== "-") {
                  information.textContent = `Created:${timeAfterticketCreation} ago . First response due in:  ${timebeforefeDue} .`
                }
                else {
                  information.textContent = `Created:${timeAfterticketCreation} ago . OverDueBy: ${timeafterOverDue} .`
                }

                const priority = document.createElement('p');
                const tooltipPrioritytext = document.createElement('p');
                priority.textContent = (ticket.priority === 1) ? "Low" : ((ticket.priority === 2) ? "Medium" : ((ticket.priority === 3) ? "High" : ((ticket.priority === 4) ? "Urgent" : null)));
                priority.className = (ticket.priority === 1) ? "low grid2FontWeights" : ((ticket.priority === 2) ? "medium grid2FontWeights" : ((ticket.priority === 3) ? "high grid2FontWeights" : ((ticket.priority === 4) ? "urgent grid2FontWeights" : null)))
                tooltipPrioritytext.textContent = "Priority"
                tooltipPrioritytext.className = "tooltipcss tooltipcssWidthPrio"
                priority.append(tooltipPrioritytext)

                const source = document.createElement('p');
                const tooltipAgenttext = document.createElement('p');
                source.textContent = "Ozonetel Integration";
                source.className = "grid2FontWeights"
                tooltipAgenttext.textContent = "Agent"
                tooltipAgenttext.className = "tooltipcss tooltipcssWidthSourceStatus"
                source.append(tooltipAgenttext)

                const status = document.createElement('p');
                const tooltipStatustext = document.createElement('p');
                status.textContent = (ticket.status === 2) ? "Open" : ((ticket.priority === 3) ? "Pending" : ((ticket.priority === 4) ? "Resolved" : ((ticket.priority === 5) ? "Closed" : null)));
                status.className = (ticket.status === 2) ? "high grid2FontWeights" : ((ticket.priority === 3) ? "urgent grid2FontWeights" : ((ticket.priority === 4) ? "medium grid2FontWeights" : ((ticket.priority === 5) ? "open grid2FontWeights" : null)))
                tooltipStatustext.textContent = "Status"
                tooltipStatustext.className = "tooltipcss tooltipcssWidthSourceStatus"
                status.append(tooltipStatustext)

                parentElement.appendChild(newCardDiv);
                newCardDiv.appendChild(grid1);
                newCardDiv.appendChild(grid2);
                grid1.appendChild(ticketType);
                grid1.appendChild(subject);
                grid1.appendChild(information);
                grid2.appendChild(priority);
                grid2.appendChild(source);
                grid2.appendChild(status);
              })
            }
          }
          catch (error) {
            console.error(error);
            fdApp.interface.notify("danger", "getTicket:", error);
          }
        }
      }
      catch (error) {
        console.error(error);
        fdApp.interface.notify("danger", "searchContact:", error);
      }
    }
  }
}

document.onreadystatechange = function () {
  fdApp.init()
};
